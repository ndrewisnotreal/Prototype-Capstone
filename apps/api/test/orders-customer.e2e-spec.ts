import 'reflect-metadata'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { OrderStatus, PaymentStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'
import request from 'supertest'
import { AppModule } from '../src/app.module.js'
import { setupApp } from '../src/app.setup.js'
import { paymentProofDir } from '../src/modules/files/storage.service.js'
import { CUSTOMER_CANCEL_REASON } from '../src/modules/orders/orders.service.js'
import { PrismaService } from '../src/prisma/prisma.service.js'

const PASSWORD = 'rahasia-123'
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
])
const PDF = Buffer.from('%PDF-1.4\n%bukti\n')
const HOUR = 60 * 60 * 1000
type Agent = ReturnType<typeof request.agent>

describe('Pesanan customer (e2e, database schema e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let rina: Agent
  let budi: Agent
  let staff: Agent
  let rinaId: number
  let budiId: number
  let brandId: number
  let categoryId: number
  let seq = 0

  const login = async (email: string) => {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200)
    return agent
  }
  /** Pesanan siap uji dengan 1 sepatu RESERVED milik `customerId`. */
  async function order(
    customerId: number,
    over: { status?: OrderStatus; paymentStatus?: PaymentStatus; expiresIn?: number } = {},
  ) {
    seq++
    const product = await prisma.product.create({
      data: {
        code: `SSB-T${seq}`,
        model: `Model ${seq}`,
        price: 300000,
        status: 'RESERVED',
        sizeEu: 42.5,
        condition: 'GOOD',
        brandId,
        categoryId,
      },
    })
    return prisma.order.create({
      data: {
        code: `INV-20261011-${String(seq).padStart(4, '0')}`,
        customerId,
        status: over.status ?? 'AWAITING_PAYMENT',
        paymentStatus: over.paymentStatus ?? 'UNPAID',
        fulfillment: 'PICKUP',
        recipientName: 'Rina',
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
            sizeEu: 42.5,
            condition: 'GOOD',
          },
        },
        history: { create: { toStatus: 'AWAITING_PAYMENT', actorId: customerId } },
      },
      include: { items: true },
    })
  }
  const upload = (
    agent: Agent,
    code: string,
    file: Buffer | null = PNG,
    fields: Record<string, string> = {},
  ) => {
    let req = agent.post(`/api/orders/${code}/payment-proofs`)
    for (const [k, v] of Object.entries({
      senderName: 'Rina S',
      senderBank: 'BCA',
      amount: '300000',
      ...fields,
    }))
      req = req.field(k, v)
    return file ? req.attach('file', file, 'bukti.png') : req
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = setupApp(moduleRef.createNestApplication())
    await app.init()
    prisma = app.get(PrismaService)
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Product", "Brand", "Category", "User", "Order", "StoreSetting", "BankAccount" RESTART IDENTITY CASCADE',
    )
    const passwordHash = await bcrypt.hash(PASSWORD, 4)
    rinaId = (
      await prisma.user.create({ data: { name: 'Rina', email: 'rina@e2e.test', passwordHash } })
    ).id
    budiId = (
      await prisma.user.create({ data: { name: 'Budi', email: 'budi@e2e.test', passwordHash } })
    ).id
    await prisma.user.create({
      data: { name: 'Staf', email: 'staff@e2e.test', role: 'STAFF', passwordHash },
    })
    brandId = (await prisma.brand.create({ data: { name: 'Nike' } })).id
    categoryId = (await prisma.category.create({ data: { name: 'Basket', slug: 'basket' } })).id
    await prisma.storeSetting.create({
      data: { whatsapp: '0812', address: 'Jl. Toko, Medan', openingHours: [] },
    })
    await prisma.bankAccount.createMany({
      data: [
        { bankName: 'BCA', accountNumber: '111', accountName: 'Suwandi' },
        { bankName: 'Lama', accountNumber: '999', accountName: 'Suwandi', isActive: false },
      ],
    })
    rina = await login('rina@e2e.test')
    budi = await login('budi@e2e.test')
    staff = await login('staff@e2e.test')
  })

  afterAll(() => app.close())

  describe('daftar dan detail', () => {
    it('daftar per tab, terbaru dulu, hanya milik sendiri', async () => {
      const unpaid = await order(rinaId)
      const shipped = await order(rinaId, { status: 'SHIPPED', paymentStatus: 'VERIFIED' })
      await order(budiId)
      const all = await rina.get('/api/orders').expect(200)
      expect(all.body.data.map((o: { code: string }) => o.code)).toEqual([
        shipped.code,
        unpaid.code,
      ])
      expect(all.body.meta).toEqual({ page: 1, limit: 10, total: 2 })
      expect(
        (await rina.get('/api/orders?tab=processing').expect(200)).body.data.map(
          (o: { code: string }) => o.code,
        ),
      ).toEqual([shipped.code])
      expect((await rina.get('/api/orders?tab=unpaid').expect(200)).body.data).toHaveLength(1)
      await rina.get('/api/orders?tab=lainnya').expect(400)
    })

    it('jumlah per tab dan isi kartu (nama sepatu, alasan tolak terakhir)', async () => {
      await prisma.order.deleteMany({ where: { customerId: { in: [rinaId, budiId] } } })
      const rejected = await order(rinaId, { paymentStatus: 'REJECTED' })
      await prisma.paymentProof.createMany({
        data: [
          {
            orderId: rejected.id,
            fileKey: 'a.png',
            senderName: 'R',
            senderBank: 'BCA',
            amount: 1,
            status: 'REJECTED',
            rejectReason: 'Lama',
            createdAt: new Date(Date.now() - HOUR),
          },
          {
            orderId: rejected.id,
            fileKey: 'b.png',
            senderName: 'R',
            senderBank: 'BCA',
            amount: 1,
            status: 'REJECTED',
            rejectReason: 'Nominal kurang',
          },
        ],
      })
      await order(rinaId, { status: 'READY_FOR_PICKUP', paymentStatus: 'VERIFIED' })
      await order(rinaId, { status: 'CANCELLED' })
      await order(budiId)
      const counts = await rina.get('/api/orders/counts').expect(200)
      expect(counts.body).toEqual({
        all: 3,
        unpaid: 1,
        verifying: 0,
        processing: 1,
        completed: 0,
        cancelled: 1,
      })
      const card = (await rina.get('/api/orders?tab=unpaid').expect(200)).body.data[0]
      expect(card).toMatchObject({
        itemNames: [`Nike Model ${seq - 3}`],
        rejectReason: 'Nominal kurang',
        courier: null,
      })
      await staff.get('/api/orders/counts').expect(403)
    })

    it('detail lengkap; pesanan orang lain 404 (tidak bocor); pegawai tidak lewat jalur customer', async () => {
      const o = await order(rinaId)
      const res = await rina.get(`/api/orders/${o.code.toLowerCase()}`).expect(200)
      expect(res.body).toMatchObject({
        code: o.code,
        status: 'AWAITING_PAYMENT',
        items: [
          {
            productCode: `SSB-T${seq}`,
            brand: 'Nike',
            sizeEu: 42.5,
            price: 300000,
            photoUrl: null,
          },
        ],
        history: [{ fromStatus: null, toStatus: 'AWAITING_PAYMENT' }],
        proofs: [],
        recipient: { name: 'Rina', phone: '081234567890' },
      })
      expect((await budi.get(`/api/orders/${o.code}`).expect(404)).body.code).toBe(
        'ORDER_NOT_FOUND',
      )
      await staff.get(`/api/orders/${o.code}`).expect(403)
    })

    it('instruksi bayar: hanya rekening aktif + batas bayar', async () => {
      const o = await order(rinaId)
      const res = await rina.get(`/api/orders/${o.code}/payment-instructions`).expect(200)
      expect(res.body).toMatchObject({
        code: o.code,
        total: 300000,
        expiresAt: o.expiresAt.toISOString(),
        lastRejectReason: null,
      })
      expect(res.body.bankAccounts.map((b: { bankName: string }) => b.bankName)).toEqual(['BCA'])
    })
  })

  describe('unggah bukti', () => {
    it('berhasil: status berubah, history, file privat yang hanya bisa dibuka pemilik/pegawai', async () => {
      const o = await order(rinaId)
      const res = await upload(rina, o.code).expect(201)
      expect(res.body).toMatchObject({
        status: 'AWAITING_VERIFICATION',
        paymentStatus: 'PENDING_VERIFICATION',
        proofs: [{ senderName: 'Rina S', senderBank: 'BCA', amount: 300000, status: 'PENDING' }],
      })
      expect(res.body.history.map((h: { toStatus: string }) => h.toStatus)).toEqual([
        'AWAITING_PAYMENT',
        'AWAITING_VERIFICATION',
      ])

      const proof = await prisma.paymentProof.findFirstOrThrow({ where: { orderId: o.id } })
      expect(existsSync(join(paymentProofDir(), proof.fileKey))).toBe(true)
      // Tidak ada jalur statis ke folder bukti
      await request(app.getHttpServer())
        .get(`/api/uploads/payment-proofs/${proof.fileKey}`)
        .expect(404)
      const url = `/api/files/payment-proofs/${proof.id}`
      const own = await rina.get(url).expect(200)
      expect(own.headers['content-type']).toBe('image/png')
      expect(own.headers['cache-control']).toBe('private, no-store')
      await staff.get(url).expect(200)
      await budi.get(url).expect(404)
      await request(app.getHttpServer()).get(url).expect(401)
    })

    it('PDF diterima; file palsu, tanpa file, dan field kosong ditolak', async () => {
      const o = await order(rinaId)
      expect((await upload(rina, o.code, Buffer.from('bukan gambar')).expect(400)).body.code).toBe(
        'INVALID_PROOF_FILE',
      )
      expect((await upload(rina, o.code, null).expect(400)).body.code).toBe('PROOF_FILE_REQUIRED')
      const bad = await upload(rina, o.code, PNG, { senderName: '', amount: '0' }).expect(400)
      expect(bad.body.details.errors).toEqual(
        expect.arrayContaining(['Nama pengirim 2 sampai 100 karakter', 'Nominal wajib diisi']),
      )
      const ok = await rina
        .post(`/api/orders/${o.code}/payment-proofs`)
        .field('senderName', 'Rina S')
        .field('senderBank', 'BCA')
        .field('amount', '300000')
        .attach('file', PDF, 'bukti.pdf')
        .expect(201)
      expect(ok.body.status).toBe('AWAITING_VERIFICATION')
    })

    it('ditolak bila sudah diunggah, lewat batas, atau bukan pesanannya', async () => {
      const verifying = await order(rinaId, {
        status: 'AWAITING_VERIFICATION',
        paymentStatus: 'PENDING_VERIFICATION',
      })
      expect((await upload(rina, verifying.code).expect(409)).body.code).toBe(
        'ORDER_NOT_AWAITING_PAYMENT',
      )
      const expired = await order(rinaId, { expiresIn: -1 })
      expect((await upload(rina, expired.code).expect(409)).body.code).toBe('ORDER_EXPIRED')
      await upload(budi, (await order(rinaId)).code).expect(404)
    })

    it('setelah bukti ditolak boleh unggah ulang; alasan penolakan terlihat', async () => {
      const o = await order(rinaId, { paymentStatus: 'REJECTED' })
      await prisma.paymentProof.create({
        data: {
          orderId: o.id,
          fileKey: 'lama.png',
          senderName: 'Rina',
          senderBank: 'BCA',
          amount: 30000,
          status: 'REJECTED',
          rejectReason: 'Nominal kurang dari total',
        },
      })
      const info = await rina.get(`/api/orders/${o.code}/payment-instructions`).expect(200)
      expect(info.body.lastRejectReason).toBe('Nominal kurang dari total')
      const res = await upload(rina, o.code).expect(201)
      expect(res.body.paymentStatus).toBe('PENDING_VERIFICATION')
      expect(res.body.proofs.map((p: { status: string }) => p.status)).toEqual([
        'PENDING',
        'REJECTED',
      ])
    })
  })

  describe('batal oleh customer', () => {
    it('hanya saat menunggu pembayaran; sepatu kembali tersedia', async () => {
      const o = await order(rinaId)
      const res = await rina.post(`/api/orders/${o.code}/cancel`).expect(201)
      expect(res.body).toMatchObject({ status: 'CANCELLED', cancelReason: CUSTOMER_CANCEL_REASON })
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: o.items[0].productId } })).status,
      ).toBe('AVAILABLE')
      expect((await rina.post(`/api/orders/${o.code}/cancel`).expect(409)).body.code).toBe(
        'ORDER_NOT_CANCELLABLE',
      )

      const verifying = await order(rinaId, {
        status: 'AWAITING_VERIFICATION',
        paymentStatus: 'PENDING_VERIFICATION',
      })
      await rina.post(`/api/orders/${verifying.code}/cancel`).expect(409)
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: verifying.items[0].productId } }))
          .status,
      ).toBe('RESERVED')
    })
  })

  describe('invoice', () => {
    it('hanya setelah VERIFIED; pemilik dan pegawai boleh, customer lain 404', async () => {
      const unpaid = await order(rinaId)
      expect((await rina.get(`/api/orders/${unpaid.code}/invoice`).expect(409)).body.code).toBe(
        'INVOICE_NOT_AVAILABLE',
      )

      const done = await order(rinaId, { status: 'COMPLETED', paymentStatus: 'VERIFIED' })
      const reviewedAt = new Date('2026-10-11T08:00:00Z')
      await prisma.paymentProof.create({
        data: {
          orderId: done.id,
          fileKey: 'x.png',
          senderName: 'Rina',
          senderBank: 'BCA',
          amount: 300000,
          status: 'ACCEPTED',
          reviewedAt,
          reviewedById: (await prisma.user.findFirstOrThrow({ where: { role: 'STAFF' } })).id,
        },
      })
      const res = await rina.get(`/api/orders/${done.code}/invoice`).expect(200)
      expect(res.body).toMatchObject({
        code: done.code,
        verifiedAt: reviewedAt.toISOString(),
        payment: { senderBank: 'BCA', senderName: 'Rina', verifiedBy: 'Staf' },
        customer: { name: 'Rina', email: 'rina@e2e.test' },
        total: 300000,
        items: [{ brand: 'Nike', price: 300000 }],
        store: { address: 'Jl. Toko, Medan', whatsapp: '0812' },
      })
      await staff.get(`/api/orders/${done.code}/invoice`).expect(200)
      await budi.get(`/api/orders/${done.code}/invoice`).expect(404)
    })
  })
})
