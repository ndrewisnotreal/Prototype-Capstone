import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma, type Fulfillment, type OrderStatus } from '@prisma/client'
import {
  assertTransition,
  ORDER_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  type AuthUserDto,
  type InvoiceDto,
  type OrderDetailDto,
  type OrderSummaryDto,
  type OrderTab,
  type OrderTabCounts,
  type Paginated,
  type PaymentInstructionsDto,
} from '@ssb/shared'
import { nextOrderCode, orderCodePrefix } from '../../common/utils/order-code.js'
import { PrismaService } from '../../prisma/prisma.service.js'
import { ActivityAction, ActivityLogService } from '../activity-log/activity-log.service.js'
import { StorageService } from '../files/storage.service.js'
import type { CheckoutDto, OrderListQueryDto, SubmitProofDto } from './orders.dto.js'

const HOUR_MS = 60 * 60 * 1000
/** [KONFIRMASI] no. 2: dipakai bila StoreSetting belum ada */
const DEFAULT_PAYMENT_DEADLINE_HOURS = 24
/** Kunci advisory Postgres untuk penomoran kode pesanan (angka bebas, asal unik di aplikasi ini). */
const ORDER_CODE_LOCK = 52_000_001
export const EXPIRED_REASON = 'Lewat batas waktu pembayaran'
/** Satu putaran scheduler memproses paling banyak segini; sisanya di putaran berikutnya. */
const EXPIRE_BATCH = 100
export const CUSTOMER_CANCEL_REASON = 'Dibatalkan oleh customer'
/** [KONFIRMASI] no. 7: sisa waktu minimal setelah bukti ditolak, supaya customer sempat unggah ulang */
export const REJECT_GRACE_HOURS = 2

const TAB_STATUSES: Record<OrderTab, OrderStatus[] | undefined> = {
  all: undefined,
  unpaid: ['AWAITING_PAYMENT'],
  verifying: ['AWAITING_VERIFICATION'],
  processing: ['PROCESSING', 'READY_FOR_PICKUP', 'SHIPPED'],
  completed: ['COMPLETED'],
  cancelled: ['CANCELLED'],
}

export const SUMMARY_INCLUDE = {
  items: {
    orderBy: { id: 'asc' },
    select: {
      brandName: true,
      model: true,
      product: {
        select: { photos: { where: { isPrimary: true }, select: { url: true }, take: 1 } },
      },
    },
  },
  proofs: {
    where: { status: 'REJECTED' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { status: true, rejectReason: true },
  },
} satisfies Prisma.OrderInclude
type SummaryRow = Prisma.OrderGetPayload<{ include: typeof SUMMARY_INCLUDE }>

export function toOrderSummary(o: SummaryRow): OrderSummaryDto {
  return {
    code: o.code,
    createdAt: o.createdAt.toISOString(),
    status: o.status,
    paymentStatus: o.paymentStatus,
    fulfillment: o.fulfillment,
    total: o.totalAmount,
    itemCount: o.items.length,
    thumbnails: o.items.flatMap((i) => i.product.photos.map((p) => p.url)),
    itemNames: o.items.map((i) => `${i.brandName} ${i.model}`),
    expiresAt: o.expiresAt.toISOString(),
    courier: o.courier,
    trackingNumber: o.trackingNumber,
    cancelReason: o.cancelReason,
    // proofs terbaru dulu, baik di SUMMARY_INCLUDE maupun DETAIL_INCLUDE
    rejectReason: o.proofs.find((p) => p.status === 'REJECTED')?.rejectReason ?? null,
  }
}

export const DETAIL_INCLUDE = {
  items: {
    orderBy: { id: 'asc' },
    include: {
      product: {
        select: {
          code: true,
          photos: { where: { isPrimary: true }, select: { url: true }, take: 1 },
        },
      },
    },
  },
  history: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  proofs: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
} satisfies Prisma.OrderInclude
type DetailRow = Prisma.OrderGetPayload<{ include: typeof DETAIL_INCLUDE }>

const toItems = (o: DetailRow) =>
  o.items.map((i) => ({
    productCode: i.product.code,
    brand: i.brandName,
    model: i.model,
    sizeEu: Number(i.sizeEu),
    condition: i.condition,
    price: i.price,
    photoUrl: i.product.photos[0]?.url ?? null,
  }))

export function toOrderDetail(o: DetailRow): OrderDetailDto {
  return {
    ...toOrderSummary(o),
    items: toItems(o),
    history: o.history.map((h) => ({
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      note: h.note,
      createdAt: h.createdAt.toISOString(),
    })),
    proofs: o.proofs.map((p) => ({
      id: p.id,
      senderName: p.senderName,
      senderBank: p.senderBank,
      amount: p.amount,
      status: p.status,
      rejectReason: p.rejectReason,
      createdAt: p.createdAt.toISOString(),
    })),
    recipient: { name: o.recipientName, phone: o.recipientPhone },
    shippingAddress: o.shippingAddress,
  }
}

export const orderNotFound = () =>
  new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Pesanan tidak ditemukan.' })

const proofNotPending = () =>
  new ConflictException({
    code: 'PROOF_NOT_PENDING',
    message: 'Bukti ini sudah diperiksa atau pesanannya sudah berubah. Muat ulang antrean.',
  })
type StaffOrderRow = { id: number; code: string; items: { productId: number }[] }

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityLogService,
  ) {}

  // ---------- Customer: baca ----------

  async listForCustomer(
    customerId: number,
    q: OrderListQueryDto,
  ): Promise<Paginated<OrderSummaryDto>> {
    const page = q.page ?? 1
    const limit = q.limit ?? 10
    const statuses = TAB_STATUSES[q.tab ?? 'all']
    const where: Prisma.OrderWhereInput = {
      customerId,
      ...(statuses && { status: { in: statuses } }),
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: SUMMARY_INCLUDE,
      }),
      this.prisma.order.count({ where }),
    ])
    return { data: rows.map(toOrderSummary), meta: { page, limit, total } }
  }

  async countsForCustomer(customerId: number): Promise<OrderTabCounts> {
    const groups = await this.prisma.order.groupBy({
      by: ['status'],
      where: { customerId },
      _count: { _all: true },
    })
    const count = (statuses?: OrderStatus[]) =>
      groups
        .filter((g) => !statuses || statuses.includes(g.status))
        .reduce((sum, g) => sum + g._count._all, 0)
    return Object.fromEntries(
      Object.entries(TAB_STATUSES).map(([tab, statuses]) => [tab, count(statuses)]),
    ) as OrderTabCounts
  }

  async detailForCustomer(customerId: number, code: string): Promise<OrderDetailDto> {
    return toOrderDetail(await this.ownOrder(customerId, code))
  }

  async paymentInstructions(customerId: number, code: string): Promise<PaymentInstructionsDto> {
    const order = await this.ownOrder(customerId, code)
    const bankAccounts = await this.prisma.bankAccount.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, bankName: true, accountNumber: true, accountName: true },
    })
    return {
      code: order.code,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.totalAmount,
      expiresAt: order.expiresAt.toISOString(),
      bankAccounts,
      lastRejectReason: order.proofs.find((p) => p.status === 'REJECTED')?.rejectReason ?? null,
    }
  }

  /** Invoice: pemilik pesanan, atau pegawai/owner. Hanya setelah pembayaran diverifikasi. */
  async invoice(user: AuthUserDto, code: string): Promise<InvoiceDto> {
    const order = await this.prisma.order.findUnique({
      where: { code: code.toUpperCase() },
      include: { ...DETAIL_INCLUDE, customer: { select: { name: true, email: true } } },
    })
    if (!order || (user.role === 'CUSTOMER' && order.customerId !== user.id)) throw orderNotFound()
    if (order.paymentStatus !== 'VERIFIED') {
      throw new ConflictException({
        code: 'INVOICE_NOT_AVAILABLE',
        message: 'Invoice tersedia setelah pembayaran diverifikasi.',
      })
    }
    const store = await this.prisma.storeSetting.findUnique({ where: { id: 1 } })
    const accepted = order.proofs.find((p) => p.status === 'ACCEPTED')
    const verifier = accepted?.reviewedById
      ? await this.prisma.user.findUnique({
          where: { id: accepted.reviewedById },
          select: { name: true },
        })
      : null
    return {
      code: order.code,
      createdAt: order.createdAt.toISOString(),
      verifiedAt: accepted?.reviewedAt?.toISOString() ?? null,
      fulfillment: order.fulfillment,
      customer: order.customer,
      recipient: { name: order.recipientName, phone: order.recipientPhone },
      shippingAddress: order.shippingAddress,
      items: toItems(order),
      total: order.totalAmount,
      store: { address: store?.address ?? '', whatsapp: store?.whatsapp ?? '' },
      payment: accepted
        ? {
            senderBank: accepted.senderBank,
            senderName: accepted.senderName,
            verifiedBy: verifier?.name ?? null,
          }
        : null,
    }
  }

  /** File bukti transfer: pemilik pesanan, pegawai, owner. Orang lain dapat 404 (tidak membocorkan keberadaan). */
  async proofFile(user: AuthUserDto, proofId: number) {
    const proof = await this.prisma.paymentProof.findUnique({
      where: { id: proofId },
      select: { fileKey: true, order: { select: { customerId: true } } },
    })
    if (!proof || (user.role === 'CUSTOMER' && proof.order.customerId !== user.id)) {
      throw new NotFoundException({
        code: 'PROOF_NOT_FOUND',
        message: 'Bukti transfer tidak ditemukan.',
      })
    }
    return this.storage.paymentProofFile(proof.fileKey)
  }

  // ---------- Customer: ubah ----------

  /** Unggah bukti: AWAITING_PAYMENT → AWAITING_VERIFICATION, pembayaran UNPAID/REJECTED → PENDING_VERIFICATION. */
  async submitProof(
    customerId: number,
    code: string,
    file: Express.Multer.File | undefined,
    dto: SubmitProofDto,
  ): Promise<OrderDetailDto> {
    if (!file) {
      throw new BadRequestException({
        code: 'PROOF_FILE_REQUIRED',
        message: 'Pilih file bukti transfer.',
      })
    }
    const order = await this.ownOrder(customerId, code)
    const now = new Date()
    this.assertAwaitingPayment(order, now)
    assertTransition(ORDER_TRANSITIONS, order.status, 'AWAITING_VERIFICATION')
    assertTransition(PAYMENT_TRANSITIONS, order.paymentStatus, 'PENDING_VERIFICATION')

    const fileKey = await this.storage.savePaymentProof(file)
    try {
      await this.prisma.$transaction(async (tx) => {
        // Bersyarat: kalah cepat dengan scheduler kedaluwarsa atau unggahan lain → gagal dengan jelas
        const { count } = await tx.order.updateMany({
          where: { id: order.id, status: 'AWAITING_PAYMENT', expiresAt: { gt: now } },
          data: { status: 'AWAITING_VERIFICATION', paymentStatus: 'PENDING_VERIFICATION' },
        })
        if (count === 0) throw this.notAwaitingPayment()
        await tx.paymentProof.create({
          data: {
            orderId: order.id,
            fileKey,
            senderName: dto.senderName,
            senderBank: dto.senderBank,
            amount: dto.amount,
          },
        })
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: 'AWAITING_PAYMENT',
            toStatus: 'AWAITING_VERIFICATION',
            actorId: customerId,
          },
        })
      })
    } catch (e) {
      await this.storage.removePaymentProof(fileKey) // jangan tinggalkan file yatim
      throw e
    }
    return this.detailForCustomer(customerId, code)
  }

  /** Customer hanya bisa membatalkan sebelum mengunggah bukti (business-rules: Status pesanan). */
  async cancelByCustomer(customerId: number, code: string): Promise<OrderDetailDto> {
    const order = await this.ownOrder(customerId, code)
    const notCancellable = () =>
      new ConflictException({
        code: 'ORDER_NOT_CANCELLABLE',
        message: 'Pesanan hanya bisa dibatalkan sebelum bukti transfer diunggah.',
      })
    if (order.status !== 'AWAITING_PAYMENT') throw notCancellable()
    assertTransition(ORDER_TRANSITIONS, order.status, 'CANCELLED')

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: 'AWAITING_PAYMENT' },
        data: {
          status: 'CANCELLED',
          cancelReason: CUSTOMER_CANCEL_REASON,
          cancelledById: customerId,
        },
      })
      if (count === 0) throw notCancellable()
      await tx.product.updateMany({
        where: { id: { in: order.items.map((i) => i.productId) }, status: 'RESERVED' },
        data: { status: 'AVAILABLE' },
      })
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: 'AWAITING_PAYMENT',
          toStatus: 'CANCELLED',
          note: CUSTOMER_CANCEL_REASON,
          actorId: customerId,
        },
      })
    })
    return this.detailForCustomer(customerId, code)
  }

  // ---------- Pegawai/owner: verifikasi dan proses (business-rules: Verifikasi, Pemrosesan) ----------

  /** Terima bukti: pesanan PROCESSING + VERIFIED, sepatu RESERVED → SOLD. Mengembalikan kode pesanan. */
  async acceptProof(actorId: number, proofId: number): Promise<string> {
    const { proof, order } = await this.pendingProof(proofId)
    assertTransition(ORDER_TRANSITIONS, order.status, 'PROCESSING')
    assertTransition(PAYMENT_TRANSITIONS, order.paymentStatus, 'VERIFIED')
    const now = new Date()
    await this.prisma.$transaction(async (tx) => {
      await this.claimProof(tx, proof.id, {
        status: 'ACCEPTED',
        reviewedById: actorId,
        reviewedAt: now,
      })
      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: 'AWAITING_VERIFICATION' },
        data: { status: 'PROCESSING', paymentStatus: 'VERIFIED', processedById: actorId },
      })
      if (count === 0) throw proofNotPending()
      await tx.product.updateMany({
        where: { id: { in: order.items.map((i) => i.productId) }, status: 'RESERVED' },
        data: { status: 'SOLD', soldAt: now },
      })
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: 'AWAITING_VERIFICATION',
          toStatus: 'PROCESSING',
          actorId,
        },
      })
      await this.activity.record(tx, {
        actorId,
        action: ActivityAction.PAYMENT_ACCEPTED,
        entityType: 'Order',
        entityId: order.code,
        before: { status: order.status, paymentStatus: order.paymentStatus },
        after: { status: 'PROCESSING', paymentStatus: 'VERIFIED', proofId: proof.id },
      })
    })
    return order.code
  }

  /**
   * Tolak bukti: pesanan kembali AWAITING_PAYMENT + REJECTED, alasan terlihat customer.
   * Bila sisa waktu < REJECT_GRACE_HOURS, batas bayar diperpanjang supaya sempat unggah ulang ([KONFIRMASI] no. 7).
   */
  async rejectProof(actorId: number, proofId: number, reason: string): Promise<string> {
    const { proof, order } = await this.pendingProof(proofId)
    assertTransition(ORDER_TRANSITIONS, order.status, 'AWAITING_PAYMENT')
    assertTransition(PAYMENT_TRANSITIONS, order.paymentStatus, 'REJECTED')
    const now = new Date()
    const graceUntil = new Date(now.getTime() + REJECT_GRACE_HOURS * HOUR_MS)
    const expiresAt = order.expiresAt < graceUntil ? graceUntil : order.expiresAt
    await this.prisma.$transaction(async (tx) => {
      await this.claimProof(tx, proof.id, {
        status: 'REJECTED',
        rejectReason: reason,
        reviewedById: actorId,
        reviewedAt: now,
      })
      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: 'AWAITING_VERIFICATION' },
        data: { status: 'AWAITING_PAYMENT', paymentStatus: 'REJECTED', expiresAt },
      })
      if (count === 0) throw proofNotPending()
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: 'AWAITING_VERIFICATION',
          toStatus: 'AWAITING_PAYMENT',
          note: reason,
          actorId,
        },
      })
      await this.activity.record(tx, {
        actorId,
        action: ActivityAction.PAYMENT_REJECTED,
        entityType: 'Order',
        entityId: order.code,
        before: { status: order.status, paymentStatus: order.paymentStatus },
        after: { status: 'AWAITING_PAYMENT', paymentStatus: 'REJECTED', proofId: proof.id, reason },
      })
    })
    return order.code
  }

  /** Ambil di toko: PROCESSING → READY_FOR_PICKUP */
  markReady(actorId: number, code: string) {
    return this.staffTransition(actorId, code, {
      to: 'READY_FOR_PICKUP',
      fulfillment: 'PICKUP',
    })
  }

  /** Ekspedisi: PROCESSING → SHIPPED dengan kurir dan resi */
  markShipped(actorId: number, code: string, courier: string, trackingNumber: string) {
    return this.staffTransition(actorId, code, {
      to: 'SHIPPED',
      fulfillment: 'SHIPPING',
      data: { courier, trackingNumber },
      note: `${courier}, resi ${trackingNumber}`,
    })
  }

  /** READY_FOR_PICKUP | SHIPPED → COMPLETED */
  markCompleted(actorId: number, code: string) {
    return this.staffTransition(actorId, code, { to: 'COMPLETED' })
  }

  /**
   * Batal oleh pegawai/owner dengan alasan. Sepatu RESERVED kembali AVAILABLE; bila sudah SOLD (pembayaran diterima)
   * juga kembali AVAILABLE, refund dilakukan manual di luar sistem.
   */
  cancelByStaff(actorId: number, code: string, reason: string) {
    return this.staffTransition(actorId, code, {
      to: 'CANCELLED',
      data: { cancelReason: reason, cancelledById: actorId },
      note: reason,
      after: async (tx, order) => {
        await tx.product.updateMany({
          where: {
            id: { in: order.items.map((i) => i.productId) },
            status: { in: ['RESERVED', 'SOLD'] },
          },
          data: { status: 'AVAILABLE', soldAt: null },
        })
      },
    })
  }

  private async staffTransition(
    actorId: number,
    code: string,
    opts: {
      to: OrderStatus
      fulfillment?: Fulfillment
      data?: Prisma.OrderUpdateManyMutationInput
      note?: string
      after?: (tx: Prisma.TransactionClient, order: StaffOrderRow) => Promise<void>
    },
  ): Promise<string> {
    const order = await this.prisma.order.findUnique({
      where: { code: code.toUpperCase() },
      include: { items: { select: { productId: true } } },
    })
    if (!order) throw orderNotFound()
    assertTransition(ORDER_TRANSITIONS, order.status, opts.to)
    if (opts.fulfillment && order.fulfillment !== opts.fulfillment) {
      throw new ConflictException({
        code: 'FULFILLMENT_MISMATCH',
        message:
          opts.fulfillment === 'PICKUP'
            ? 'Pesanan ini dikirim lewat ekspedisi, bukan diambil di toko.'
            : 'Pesanan ini diambil di toko, bukan dikirim.',
      })
    }
    await this.prisma.$transaction(async (tx) => {
      // bersyarat: dua pegawai menekan tombol bersamaan → yang kedua gagal dengan jelas
      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { ...opts.data, status: opts.to },
      })
      if (count === 0) {
        throw new ConflictException({
          code: 'ORDER_CHANGED',
          message: 'Status pesanan baru saja berubah. Muat ulang lalu coba lagi.',
        })
      }
      await opts.after?.(tx, order)
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: opts.to,
          note: opts.note ?? null,
          actorId,
        },
      })
      await this.activity.record(tx, {
        actorId,
        action: ActivityAction.ORDER_STATUS_CHANGED,
        entityType: 'Order',
        entityId: order.code,
        before: { status: order.status },
        after: { status: opts.to, ...(opts.note && { note: opts.note }) },
      })
    })
    return order.code
  }

  /** Bukti yang masih PENDING beserta pesanannya (yang harus AWAITING_VERIFICATION) */
  private async pendingProof(proofId: number) {
    const proof = await this.prisma.paymentProof.findUnique({
      where: { id: proofId },
      include: { order: { include: { items: { select: { productId: true } } } } },
    })
    if (!proof) {
      throw new NotFoundException({
        code: 'PROOF_NOT_FOUND',
        message: 'Bukti transfer tidak ditemukan.',
      })
    }
    if (proof.status !== 'PENDING' || proof.order.status !== 'AWAITING_VERIFICATION') {
      throw proofNotPending()
    }
    return { proof, order: proof.order }
  }

  /** PENDING → ACCEPTED/REJECTED bersyarat, supaya bukti yang sama tidak diputuskan dua kali */
  private async claimProof(
    tx: Prisma.TransactionClient,
    proofId: number,
    data: Prisma.PaymentProofUpdateManyMutationInput,
  ) {
    const { count } = await tx.paymentProof.updateMany({
      where: { id: proofId, status: 'PENDING' },
      data,
    })
    if (count === 0) throw proofNotPending()
  }

  private async ownOrder(customerId: number, code: string): Promise<DetailRow> {
    const order = await this.prisma.order.findFirst({
      where: { code: code.toUpperCase(), customerId },
      include: DETAIL_INCLUDE,
    })
    if (!order) throw orderNotFound()
    return order
  }

  private notAwaitingPayment() {
    return new ConflictException({
      code: 'ORDER_NOT_AWAITING_PAYMENT',
      message: 'Pesanan ini tidak sedang menunggu pembayaran.',
    })
  }

  private assertAwaitingPayment(order: DetailRow, now: Date) {
    if (order.status !== 'AWAITING_PAYMENT') throw this.notAwaitingPayment()
    if (order.expiresAt <= now) {
      throw new ConflictException({
        code: 'ORDER_EXPIRED',
        message: 'Batas waktu pembayaran sudah lewat. Pesanan akan dibatalkan otomatis.',
      })
    }
  }

  /**
   * Checkout dengan reservasi atomik (docs/business-rules.md#reservasi): semua sepatu AVAILABLE → RESERVED
   * dalam satu transaksi, atau tidak sama sekali. Sepatu tidak bisa terjual dua kali.
   */
  async checkout(customerId: number, dto: CheckoutDto): Promise<OrderSummaryDto> {
    const settings = await this.prisma.storeSetting.findUnique({ where: { id: 1 } })
    if (settings && !settings.fulfillmentMethods.includes(dto.fulfillment)) {
      throw new BadRequestException({
        code: 'FULFILLMENT_NOT_AVAILABLE',
        message:
          dto.fulfillment === 'PICKUP'
            ? 'Ambil di toko sedang tidak tersedia.'
            : 'Pengiriman sedang tidak tersedia.',
      })
    }
    const deadlineHours = settings?.paymentDeadlineHours ?? DEFAULT_PAYMENT_DEADLINE_HOURS

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        // Update bersyarat: transaksi lain yang lebih dulu mereservasi membuat count kurang → rollback
        const { count } = await tx.product.updateMany({
          where: { id: { in: dto.productIds }, status: 'AVAILABLE' },
          data: { status: 'RESERVED' },
        })
        if (count !== dto.productIds.length) throw new ProductsUnavailable()

        const products = await tx.product.findMany({
          where: { id: { in: dto.productIds } },
          include: { brand: { select: { name: true } } },
        })
        const now = new Date()
        // Kode urut per hari: antrekan pembuat kode supaya dua checkout bersamaan tidak dapat nomor sama
        // $executeRaw: fungsi ini mengembalikan void, yang tidak bisa dibaca $queryRaw
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ORDER_CODE_LOCK})`
        const last = await tx.order.findFirst({
          where: { code: { startsWith: orderCodePrefix(now) } },
          orderBy: { code: 'desc' },
          select: { code: true },
        })

        const created = await tx.order.create({
          data: {
            code: nextOrderCode(now, last?.code ?? null),
            customerId,
            fulfillment: dto.fulfillment,
            recipientName: dto.recipientName,
            recipientPhone: dto.recipientPhone,
            shippingAddress: dto.fulfillment === 'SHIPPING' ? dto.shippingAddress : null,
            totalAmount: products.reduce((sum, p) => sum + p.price, 0),
            createdAt: now,
            expiresAt: new Date(now.getTime() + deadlineHours * HOUR_MS),
            // Salinan saat checkout: invoice tetap benar walau produk diedit kemudian
            items: {
              create: products.map((p) => ({
                productId: p.id,
                price: p.price,
                brandName: p.brand.name,
                model: p.model,
                sizeEu: p.sizeEu,
                condition: p.condition,
              })),
            },
            history: { create: { toStatus: 'AWAITING_PAYMENT', actorId: customerId } },
          },
          include: SUMMARY_INCLUDE,
        })
        await tx.cartItem.deleteMany({
          where: { userId: customerId, productId: { in: dto.productIds } },
        })
        return created
      })
      return toOrderSummary(order)
    } catch (e) {
      if (!(e instanceof ProductsUnavailable)) throw e
      // Di luar transaksi (sudah rollback): cari yang mana supaya UI menandai sepatu yang tepat
      const available = await this.prisma.product.findMany({
        where: { id: { in: dto.productIds }, status: 'AVAILABLE' },
        select: { id: true },
      })
      const availableIds = new Set(available.map((p) => p.id))
      throw new ConflictException({
        code: 'PRODUCT_NOT_AVAILABLE',
        message: 'Maaf, sepatu ini baru saja dipesan orang lain.',
        details: { unavailableProductIds: dto.productIds.filter((id) => !availableIds.has(id)) },
      })
    }
  }

  /**
   * Batalkan pesanan AWAITING_PAYMENT yang lewat batas bayar dan kembalikan sepatunya (business-rules: Batas waktu pembayaran).
   * Satu transaksi per pesanan. AWAITING_VERIFICATION tidak pernah kedaluwarsa. Mengembalikan jumlah yang dibatalkan.
   */
  async expireOverdue(now = new Date()): Promise<number> {
    const overdue = await this.prisma.order.findMany({
      where: { status: 'AWAITING_PAYMENT', expiresAt: { lt: now } },
      select: { id: true, items: { select: { productId: true } } },
      orderBy: { expiresAt: 'asc' },
      take: EXPIRE_BATCH,
    })
    assertTransition(ORDER_TRANSITIONS, 'AWAITING_PAYMENT', 'CANCELLED')

    let expired = 0
    for (const order of overdue) {
      const done = await this.prisma.$transaction(async (tx) => {
        // Bersyarat: kalau bukti baru saja diunggah atau putaran lain sudah membatalkan, lewati
        const { count } = await tx.order.updateMany({
          where: { id: order.id, status: 'AWAITING_PAYMENT', expiresAt: { lt: now } },
          data: { status: 'CANCELLED', cancelReason: EXPIRED_REASON },
        })
        if (count === 0) return false
        await tx.product.updateMany({
          where: { id: { in: order.items.map((i) => i.productId) }, status: 'RESERVED' },
          data: { status: 'AVAILABLE' },
        })
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: 'AWAITING_PAYMENT',
            toStatus: 'CANCELLED',
            note: EXPIRED_REASON,
            actorId: null, // sistem
          },
        })
        return true
      })
      if (done) expired++
    }
    return expired
  }
}

/** Penanda internal untuk membatalkan transaksi reservasi. */
class ProductsUnavailable extends Error {}
