import 'reflect-metadata'
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { Fulfillment, OrderStatus, PaymentStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'
import request from 'supertest'
import { AppModule } from '../src/app.module.js'
import { setupApp } from '../src/app.setup.js'
import { PrismaService } from '../src/prisma/prisma.service.js'

const PASSWORD = 'rahasia-123'
const HOUR = 60 * 60 * 1000
const REASON = 'Nominal kurang dari total pesanan.'
type Agent = ReturnType<typeof request.agent>

describe('Panel pegawai: verifikasi dan proses pesanan (e2e, database schema e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let staff: Agent
  let owner: Agent
  let rina: Agent
  let rinaId: number
  let staffId: number
  let brandId: number
  let categoryId: number
  let seq = 0

  const login = async (email: string) => {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200)
    return agent
  }

  /** Pesanan dengan 1 sepatu; status sepatu mengikuti status pesanan */
  async function order(
    over: {
      status?: OrderStatus
      paymentStatus?: PaymentStatus
      fulfillment?: Fulfillment
      expiresIn?: number
    } = {},
  ) {
    seq++
    const status = over.status ?? 'AWAITING_VERIFICATION'
    const paid = ['PROCESSING', 'READY_FOR_PICKUP', 'SHIPPED', 'COMPLETED'].includes(status)
    const product = await prisma.product.create({
      data: {
        code: `SSB-P${seq}`,
        model: `Model ${seq}`,
        price: 300000,
        status: paid ? 'SOLD' : 'RESERVED',
        sizeEu: 42,
        condition: 'GOOD',
        brandId,
        categoryId,
      },
    })
    const o = await prisma.order.create({
      data: {
        code: `INV-20261012-${String(seq).padStart(4, '0')}`,
        customerId: rinaId,
        status,
        paymentStatus:
          over.paymentStatus ??
          (status === 'AWAITING_VERIFICATION'
            ? 'PENDING_VERIFICATION'
            : paid
              ? 'VERIFIED'
              : 'UNPAID'),
        fulfillment: over.fulfillment ?? 'PICKUP',
        recipientName: `Penerima ${seq}`,
        recipientPhone: '081234567890',
        totalAmount: 300000,
        createdAt: new Date(Date.now() + seq * 1000),
        expiresAt: new Date(Date.now() + (over.expiresIn ?? 24) * HOUR),
        items: {
          create: {
            productId: product.id,
            price: 300000,
            brandName: 'Nike',
            model: `Model ${seq}`,
            sizeEu: 42,
            condition: 'GOOD',
          },
        },
        history: { create: { toStatus: 'AWAITING_PAYMENT', actorId: rinaId } },
      },
      include: { items: true },
    })
    const proof =
      status === 'AWAITING_VERIFICATION'
        ? await prisma.paymentProof.create({
            data: {
              orderId: o.id,
              fileKey: `p${seq}.png`,
              senderName: 'RINA',
              senderBank: 'BCA',
              amount: 300000,
              createdAt: new Date(Date.now() - (100 - seq) * 1000),
            },
          })
        : null
    return { ...o, productId: product.id, proofId: proof?.id ?? 0 }
  }
  const product = (id: number) => prisma.product.findUniqueOrThrow({ where: { id } })
  const fresh = (id: number) => prisma.order.findUniqueOrThrow({ where: { id } })

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = setupApp(moduleRef.createNestApplication())
    await app.init()
    prisma = app.get(PrismaService)
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Product", "Brand", "Category", "User", "Order", "ActivityLog" RESTART IDENTITY CASCADE',
    )
    const passwordHash = await bcrypt.hash(PASSWORD, 4)
    rinaId = (
      await prisma.user.create({ data: { name: 'Rina', email: 'rina@e2e.test', passwordHash } })
    ).id
    staffId = (
      await prisma.user.create({
        data: { name: 'Andi', email: 'staff@e2e.test', role: 'STAFF', passwordHash },
      })
    ).id
    await prisma.user.create({
      data: { name: 'Owner', email: 'owner@e2e.test', role: 'OWNER', passwordHash },
    })
    brandId = (await prisma.brand.create({ data: { name: 'Nike' } })).id
    categoryId = (await prisma.category.create({ data: { name: 'Basket', slug: 'basket' } })).id
    staff = await login('staff@e2e.test')
    owner = await login('owner@e2e.test')
    rina = await login('rina@e2e.test')
  })

  afterAll(() => app.close())

  describe('verifikasi', () => {
    it('terima: pesanan diproses, sepatu terjual, history + log; tidak bisa diterima dua kali', async () => {
      const o = await order()
      const res = await staff.post(`/api/panel/payments/${o.proofId}/accept`).expect(201)
      expect(res.body).toMatchObject({
        status: 'PROCESSING',
        paymentStatus: 'VERIFIED',
        customer: { name: 'Rina' },
      })
      expect(res.body.proofs[0].status).toBe('ACCEPTED')
      const p = await product(o.productId)
      expect(p.status).toBe('SOLD')
      expect(p.soldAt).not.toBeNull()
      expect((await fresh(o.id)).processedById).toBe(staffId)
      const log = await prisma.activityLog.findFirstOrThrow({ where: { entityId: o.code } })
      expect(log).toMatchObject({
        action: 'PAYMENT_ACCEPTED',
        actorId: staffId,
        entityType: 'Order',
      })
      const again = await owner.post(`/api/panel/payments/${o.proofId}/accept`).expect(409)
      expect(again.body.code).toBe('PROOF_NOT_PENDING')
    })

    it('terima dan tolak bersamaan: tepat satu yang berhasil', async () => {
      const o = await order()
      const results = await Promise.all([
        staff.post(`/api/panel/payments/${o.proofId}/accept`),
        owner.post(`/api/panel/payments/${o.proofId}/reject`).send({ reason: REASON }),
      ])
      expect(results.map((r) => r.status).sort()).toEqual([201, 409])
      const after = await fresh(o.id)
      expect(['PROCESSING', 'AWAITING_PAYMENT']).toContain(after.status)
      expect(await prisma.orderStatusHistory.count({ where: { orderId: o.id } })).toBe(2)
    })

    it('tolak: alasan wajib, customer melihat alasannya, batas bayar diperpanjang bila < 2 jam', async () => {
      const near = await order({ expiresIn: 0.5 })
      await staff
        .post(`/api/panel/payments/${near.proofId}/reject`)
        .send({ reason: 'buram' })
        .expect(400)
      const before = Date.now()
      const res = await staff
        .post(`/api/panel/payments/${near.proofId}/reject`)
        .send({ reason: REASON })
        .expect(201)
      expect(res.body).toMatchObject({
        status: 'AWAITING_PAYMENT',
        paymentStatus: 'REJECTED',
        rejectReason: REASON,
      })
      const extended = (await fresh(near.id)).expiresAt.getTime()
      expect(extended).toBeGreaterThanOrEqual(before + 2 * HOUR - 1000)
      expect((await product(near.productId)).status).toBe('RESERVED')
      const seen = await rina.get(`/api/orders/${near.code}`).expect(200)
      expect(seen.body.history.at(-1)).toMatchObject({ toStatus: 'AWAITING_PAYMENT', note: REASON })

      const far = await order({ expiresIn: 10 })
      const original = (await fresh(far.id)).expiresAt.getTime()
      await staff
        .post(`/api/panel/payments/${far.proofId}/reject`)
        .send({ reason: REASON })
        .expect(201)
      expect((await fresh(far.id)).expiresAt.getTime()).toBe(original)
    })

    it('antrean hanya bukti PENDING, terlama dulu; customer ditolak', async () => {
      await prisma.paymentProof.deleteMany({ where: { status: 'PENDING' } })
      const a = await order()
      const b = await order()
      const queue = (await staff.get('/api/panel/payments/pending').expect(200)).body
      expect(queue.map((p: { id: number }) => p.id)).toEqual([a.proofId, b.proofId])
      expect(queue[0].order).toMatchObject({
        code: a.code,
        total: 300000,
        customerName: 'Rina',
        itemNames: [`Nike Model ${seq - 1}`],
      })
      await rina.get('/api/panel/payments/pending').expect(403)
      await rina.post(`/api/panel/payments/${a.proofId}/accept`).expect(403)
      // bukti pegawai bisa dibuka lewat endpoint file privat (file tidak ada di disk → 404 JSON, bukan 403)
      await staff.get(`/api/files/payment-proofs/${a.proofId}`).expect(404)
    })
  })

  describe('proses pesanan', () => {
    it('ambil di toko: siap diambil lalu selesai; transisi tidak sah ditolak', async () => {
      const o = await order({ status: 'PROCESSING' })
      await staff.post(`/api/panel/orders/${o.code}/complete`).expect(409)
      expect(
        (
          await staff
            .post(`/api/panel/orders/${o.code}/ship`)
            .send({ courier: 'JNE', trackingNumber: 'JX12345678' })
            .expect(409)
        ).body.code,
      ).toBe('FULFILLMENT_MISMATCH')
      expect(
        (await staff.post(`/api/panel/orders/${o.code.toLowerCase()}/ready`).expect(201)).body
          .status,
      ).toBe('READY_FOR_PICKUP')
      expect(
        (await staff.post(`/api/panel/orders/${o.code}/complete`).expect(201)).body.status,
      ).toBe('COMPLETED')
      expect(
        (
          await staff
            .post(`/api/panel/orders/${o.code}/cancel`)
            .send({ reason: REASON })
            .expect(409)
        ).body.code,
      ).toBe('INVALID_TRANSITION')
      const history = await prisma.orderStatusHistory.findMany({
        where: { orderId: o.id },
        orderBy: { id: 'asc' },
      })
      expect(history.map((h) => h.toStatus)).toEqual([
        'AWAITING_PAYMENT',
        'READY_FOR_PICKUP',
        'COMPLETED',
      ])
      expect(
        await prisma.activityLog.count({
          where: { entityId: o.code, action: 'ORDER_STATUS_CHANGED' },
        }),
      ).toBe(2)
    })

    it('dikirim: kurir dan resi wajib, tersimpan dan terlihat customer', async () => {
      const o = await order({ status: 'PROCESSING', fulfillment: 'SHIPPING' })
      await staff.post(`/api/panel/orders/${o.code}/ready`).expect(409)
      await staff.post(`/api/panel/orders/${o.code}/ship`).send({ courier: 'JNE REG' }).expect(400)
      const res = await staff
        .post(`/api/panel/orders/${o.code}/ship`)
        .send({ courier: 'JNE REG', trackingNumber: 'JX1234567890' })
        .expect(201)
      expect(res.body).toMatchObject({
        status: 'SHIPPED',
        courier: 'JNE REG',
        trackingNumber: 'JX1234567890',
      })
      const card = (await rina.get('/api/orders?tab=processing').expect(200)).body.data.find(
        (x: { code: string }) => x.code === o.code,
      )
      expect(card.trackingNumber).toBe('JX1234567890')
    })

    it('batal oleh pegawai: alasan wajib; sepatu terjual kembali tersedia', async () => {
      const o = await order({ status: 'PROCESSING' })
      await staff.post(`/api/panel/orders/${o.code}/cancel`).send({}).expect(400)
      const res = await owner
        .post(`/api/panel/orders/${o.code}/cancel`)
        .send({ reason: REASON })
        .expect(201)
      expect(res.body).toMatchObject({ status: 'CANCELLED', cancelReason: REASON })
      const p = await product(o.productId)
      expect(p).toMatchObject({ status: 'AVAILABLE', soldAt: null })
      const shipped = await order({ status: 'SHIPPED', fulfillment: 'SHIPPING' })
      await staff
        .post(`/api/panel/orders/${shipped.code}/cancel`)
        .send({ reason: REASON })
        .expect(409)
      await rina.post(`/api/panel/orders/${shipped.code}/complete`).expect(403)
    })
  })

  describe('daftar dan dashboard', () => {
    beforeAll(async () => {
      await prisma.order.deleteMany()
    })

    it('tab, pencarian, jumlah per tab, detail dengan data customer', async () => {
      const unpaid = await order({ status: 'AWAITING_PAYMENT', expiresIn: 1 })
      const verifying = await order()
      const processing = await order({ status: 'PROCESSING' })
      const shipped = await order({ status: 'SHIPPED', fulfillment: 'SHIPPING' })
      expect((await staff.get('/api/panel/orders/counts').expect(200)).body).toEqual({
        all: 4,
        unpaid: 2,
        processing: 1,
        delivering: 1,
        completed: 0,
        cancelled: 0,
      })
      const tab = (await staff.get('/api/panel/orders?tab=unpaid').expect(200)).body
      expect(tab.data.map((o: { code: string }) => o.code)).toEqual([verifying.code, unpaid.code])
      expect(tab.data[0]).toMatchObject({
        customerName: 'Rina',
        recipient: { phone: '081234567890' },
      })
      const byCode = (await staff.get(`/api/panel/orders?q=${shipped.code.slice(-4)}`).expect(200))
        .body
      expect(byCode.data.map((o: { code: string }) => o.code)).toEqual([shipped.code])
      const byName = (await staff.get(`/api/panel/orders?q=penerima ${seq}`).expect(200)).body
      expect(byName.data.map((o: { code: string }) => o.code)).toEqual([shipped.code])
      const detail = (await owner.get(`/api/panel/orders/${processing.code}`).expect(200)).body
      expect(detail.customer).toEqual({ name: 'Rina', email: 'rina@e2e.test', phone: null })
      await staff.get('/api/panel/orders/INV-00000000-0000').expect(404)
    })

    it('dashboard: jumlah tugas, daftar tindakan, reservasi hampir habis, tanpa angka Rp', async () => {
      const res = await staff.get('/api/panel/dashboard').expect(200)
      expect(res.body.counts).toEqual({
        awaitingVerification: 1,
        toProcess: 1,
        readyOrShipped: 1,
        expiringSoon: 1,
      })
      expect(res.body.actions.map((r: { status: string }) => r.status).sort()).toEqual([
        'AWAITING_VERIFICATION',
        'PROCESSING',
      ])
      expect(res.body.expiring).toHaveLength(1)
      expect(JSON.stringify(res.body)).not.toMatch(/total|price|amount/i)
      await rina.get('/api/panel/dashboard').expect(403)
    })
  })
})
