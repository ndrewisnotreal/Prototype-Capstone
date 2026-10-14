import { Injectable } from '@nestjs/common'
import { Prisma, type OrderStatus } from '@prisma/client'
import type {
  DashboardOrderRowDto,
  Paginated,
  PanelOrderDetailDto,
  PanelOrderDto,
  PanelOrderTab,
  PanelOrderTabCounts,
  PendingProofDto,
  StaffDashboardDto,
} from '@ssb/shared'
import { PrismaService } from '../../prisma/prisma.service.js'
import type { PanelOrderListQueryDto } from './orders.dto.js'
import {
  DETAIL_INCLUDE,
  orderNotFound,
  SUMMARY_INCLUDE,
  toOrderDetail,
  toOrderSummary,
} from './orders.service.js'

/** Reservasi dianggap "hampir habis" bila sisa waktunya kurang dari ini (dashboard pegawai) */
export const EXPIRING_SOON_HOURS = 2
const DASHBOARD_ROWS = 10

const PANEL_TAB_STATUSES: Record<PanelOrderTab, OrderStatus[] | undefined> = {
  all: undefined,
  unpaid: ['AWAITING_PAYMENT', 'AWAITING_VERIFICATION'],
  processing: ['PROCESSING'],
  delivering: ['READY_FOR_PICKUP', 'SHIPPED'],
  completed: ['COMPLETED'],
  cancelled: ['CANCELLED'],
}
/** Status yang menunggu aksi pegawai (daftar "Perlu tindakan") */
const NEEDS_ACTION: OrderStatus[] = ['AWAITING_VERIFICATION', 'PROCESSING', 'READY_FOR_PICKUP']

const ROW_INCLUDE = {
  ...SUMMARY_INCLUDE,
  customer: { select: { name: true } },
} satisfies Prisma.OrderInclude
type Row = Prisma.OrderGetPayload<{ include: typeof ROW_INCLUDE }>

const toPanelOrder = (o: Row): PanelOrderDto => ({
  ...toOrderSummary(o),
  customerName: o.customer.name,
  recipient: { name: o.recipientName, phone: o.recipientPhone },
})
const toDashboardRow = (o: Row): DashboardOrderRowDto => ({
  code: o.code,
  status: o.status,
  paymentStatus: o.paymentStatus,
  fulfillment: o.fulfillment,
  itemNames: o.items.map((i) => `${i.brandName} ${i.model}`),
  customerName: o.customer.name,
  expiresAt: o.expiresAt.toISOString(),
})

/** Baca data panel pegawai/owner. Semua perubahan status tetap lewat OrdersService. */
@Injectable()
export class OrdersPanelService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: PanelOrderListQueryDto): Promise<Paginated<PanelOrderDto>> {
    const page = q.page ?? 1
    const limit = q.limit ?? 20
    const statuses = PANEL_TAB_STATUSES[q.tab ?? 'all']
    const term = q.q?.trim()
    const where: Prisma.OrderWhereInput = {
      ...(statuses && { status: { in: statuses } }),
      ...(term && {
        OR: [
          { code: { contains: term, mode: 'insensitive' } },
          { recipientName: { contains: term, mode: 'insensitive' } },
          { recipientPhone: { contains: term.replace(/[\s-]/g, '') } },
          { customer: { name: { contains: term, mode: 'insensitive' } } },
        ],
      }),
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: ROW_INCLUDE,
      }),
      this.prisma.order.count({ where }),
    ])
    return { data: rows.map(toPanelOrder), meta: { page, limit, total } }
  }

  async counts(): Promise<PanelOrderTabCounts> {
    const groups = await this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } })
    const count = (statuses?: OrderStatus[]) =>
      groups
        .filter((g) => !statuses || statuses.includes(g.status))
        .reduce((sum, g) => sum + g._count._all, 0)
    return Object.fromEntries(
      Object.entries(PANEL_TAB_STATUSES).map(([tab, statuses]) => [tab, count(statuses)]),
    ) as PanelOrderTabCounts
  }

  async detail(code: string): Promise<PanelOrderDetailDto> {
    const order = await this.prisma.order.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        ...DETAIL_INCLUDE,
        customer: { select: { name: true, email: true, phone: true } },
      },
    })
    if (!order) throw orderNotFound()
    return { ...toOrderDetail(order), customer: order.customer }
  }

  /** Antrean verifikasi: bukti PENDING dari pesanan yang masih menunggu verifikasi, terlama dulu */
  async pendingProofs(): Promise<PendingProofDto[]> {
    const proofs = await this.prisma.paymentProof.findMany({
      where: { status: 'PENDING', order: { status: 'AWAITING_VERIFICATION' } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        order: {
          include: {
            items: { orderBy: { id: 'asc' }, select: { brandName: true, model: true } },
            customer: { select: { name: true } },
          },
        },
      },
    })
    return proofs.map((p) => ({
      id: p.id,
      senderName: p.senderName,
      senderBank: p.senderBank,
      amount: p.amount,
      createdAt: p.createdAt.toISOString(),
      order: {
        code: p.order.code,
        total: p.order.totalAmount,
        expiresAt: p.order.expiresAt.toISOString(),
        itemNames: p.order.items.map((i) => `${i.brandName} ${i.model}`),
        customerName: p.order.customer.name,
        recipientPhone: p.order.recipientPhone,
      },
    }))
  }

  async dashboard(now = new Date()): Promise<StaffDashboardDto> {
    const soon = new Date(now.getTime() + EXPIRING_SOON_HOURS * 60 * 60 * 1000)
    const expiringWhere: Prisma.OrderWhereInput = {
      status: 'AWAITING_PAYMENT',
      expiresAt: { gt: now, lt: soon },
    }
    const [groups, expiringSoon, actions, expiring] = await this.prisma.$transaction([
      this.prisma.order.groupBy({
        by: ['status'],
        where: {
          status: { in: ['AWAITING_VERIFICATION', 'PROCESSING', 'READY_FOR_PICKUP', 'SHIPPED'] },
        },
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.order.count({ where: expiringWhere }),
      this.prisma.order.findMany({
        where: { status: { in: NEEDS_ACTION } },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: DASHBOARD_ROWS,
        include: ROW_INCLUDE,
      }),
      this.prisma.order.findMany({
        where: expiringWhere,
        orderBy: { expiresAt: 'asc' },
        take: DASHBOARD_ROWS,
        include: ROW_INCLUDE,
      }),
    ])
    const n = (...statuses: OrderStatus[]) =>
      groups
        .filter((g) => statuses.includes(g.status))
        .reduce((sum, g) => sum + (g._count as { _all: number })._all, 0)
    return {
      counts: {
        awaitingVerification: n('AWAITING_VERIFICATION'),
        toProcess: n('PROCESSING'),
        readyOrShipped: n('READY_FOR_PICKUP', 'SHIPPED'),
        expiringSoon,
      },
      actions: actions.map(toDashboardRow),
      expiring: expiring.map(toDashboardRow),
    }
  }
}
