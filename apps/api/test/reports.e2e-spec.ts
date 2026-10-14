import 'reflect-metadata'
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { Fulfillment, OrderStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'
import ExcelJS from 'exceljs'
import request from 'supertest'
import { AppModule } from '../src/app.module.js'
import { setupApp } from '../src/app.setup.js'
import { DAY_MS } from '../src/common/utils/wib.js'
import { PrismaService } from '../src/prisma/prisma.service.js'

const PASSWORD = 'rahasia-123'
type Agent = ReturnType<typeof request.agent>
const binary = (res: request.Response, done: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = []
  res.on('data', (c: Buffer) => chunks.push(c))
  res.on('end', () => done(null, Buffer.concat(chunks)))
}

describe('Laporan owner (e2e, database schema e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let owner: Agent
  let staff: Agent
  let staffId: number
  let rinaId: number
  let nike: number
  let adidas: number
  let basket: number
  let seq = 0

  /** Pesanan terjual: bukti ACCEPTED pada `verifiedAt`, sepatu SOLD */
  async function sale(o: {
    verifiedAt: Date
    price: number
    brandId: number
    sizeEu?: number
    daysInCatalog?: number
    status?: OrderStatus
    fulfillment?: Fulfillment
  }) {
    seq++
    const product = await prisma.product.create({
      data: {
        code: `SSB-R${seq}`,
        model: `Model ${seq}`,
        price: o.price,
        status: o.status === 'CANCELLED' ? 'AVAILABLE' : 'SOLD',
        soldAt: o.status === 'CANCELLED' ? null : o.verifiedAt,
        createdAt: new Date(o.verifiedAt.getTime() - (o.daysInCatalog ?? 10) * DAY_MS),
        sizeEu: o.sizeEu ?? 42,
        condition: 'GOOD',
        brandId: o.brandId,
        categoryId: basket,
      },
    })
    return prisma.order.create({
      data: {
        code: `INV-20260901-${String(seq).padStart(4, '0')}`,
        customerId: rinaId,
        status: o.status ?? 'COMPLETED',
        paymentStatus: 'VERIFIED',
        fulfillment: o.fulfillment ?? 'PICKUP',
        recipientName: 'Rina',
        recipientPhone: '0812',
        totalAmount: o.price,
        expiresAt: o.verifiedAt,
        createdAt: new Date(o.verifiedAt.getTime() - 3600_000),
        items: {
          create: {
            productId: product.id,
            price: o.price,
            brandName: 'Nike',
            model: `Model ${seq}`,
            sizeEu: o.sizeEu ?? 42,
            condition: 'GOOD',
          },
        },
        proofs: {
          create: {
            fileKey: 'x.png',
            senderName: 'RINA',
            senderBank: 'BCA',
            amount: o.price,
            status: 'ACCEPTED',
            reviewedAt: o.verifiedAt,
            reviewedById: staffId,
          },
        },
      },
    })
  }

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
      data: { name: 'Suwandi', email: 'owner@e2e.test', role: 'OWNER', passwordHash },
    })
    nike = (await prisma.brand.create({ data: { name: 'Nike' } })).id
    adidas = (await prisma.brand.create({ data: { name: 'Adidas' } })).id
    basket = (await prisma.category.create({ data: { name: 'Basket', slug: 'basket' } })).id
    const login = async (email: string) => {
      const agent = request.agent(app.getHttpServer())
      await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200)
      return agent
    }
    owner = await login('owner@e2e.test')
    staff = await login('staff@e2e.test')
  })

  afterAll(() => app.close())

  describe('laporan penjualan', () => {
    beforeAll(async () => {
      await sale({ verifiedAt: new Date('2026-09-10T03:00:00Z'), price: 300000, brandId: nike })
      await sale({
        verifiedAt: new Date('2026-09-20T03:00:00Z'),
        price: 500000,
        brandId: adidas,
        fulfillment: 'SHIPPING',
        status: 'SHIPPED',
      })
      // dibatalkan setelah lunas: bukan penjualan
      await sale({
        verifiedAt: new Date('2026-09-21T03:00:00Z'),
        price: 900000,
        brandId: nike,
        status: 'CANCELLED',
      })
      // 30 Sep 23.30 WIB = 30 Sep 16.30 UTC: masih September menurut WIB
      await sale({ verifiedAt: new Date('2026-09-30T16:30:00Z'), price: 200000, brandId: nike })
      // 1 Okt 00.30 WIB = 30 Sep 17.30 UTC: sudah Oktober
      await sale({ verifiedAt: new Date('2026-09-30T17:30:00Z'), price: 999000, brandId: nike })
    })

    it('ringkasan + transaksi, batas tanggal WIB, tanpa pesanan batal', async () => {
      const res = await owner
        .get('/api/owner/reports/sales?from=2026-09-01&to=2026-09-30')
        .expect(200)
      expect(res.body.summary).toEqual({
        revenue: 1000000,
        transactions: 3,
        itemsSold: 3,
        averagePerItem: 333333,
      })
      expect(res.body.rows.map((r: { total: number }) => r.total)).toEqual([200000, 500000, 300000])
      expect(res.body.rows[0]).toMatchObject({
        verifiedBy: 'Andi',
        customerName: 'Rina',
        fulfillment: 'PICKUP',
      })
      const shipped = await owner
        .get('/api/owner/reports/sales?from=2026-09-01&to=2026-09-30&fulfillment=SHIPPING')
        .expect(200)
      expect(shipped.body.summary.revenue).toBe(500000)
    })

    it('rentang tidak sah ditolak; pegawai tidak boleh', async () => {
      expect(
        (await owner.get('/api/owner/reports/sales?from=2026-09-30&to=2026-09-01').expect(400)).body
          .code,
      ).toBe('INVALID_RANGE')
      await owner.get('/api/owner/reports/sales?from=2026-9-1&to=2026-09-30').expect(400)
      await staff.get('/api/owner/reports/sales?from=2026-09-01&to=2026-09-30').expect(403)
      await staff.get('/api/owner/dashboard').expect(403)
    })

    it('ekspor PDF dan Excel berisi data yang sama', async () => {
      const pdf = await owner
        .get('/api/owner/reports/sales/export?format=pdf&from=2026-09-01&to=2026-09-30')
        .buffer(true)
        .parse(binary)
        .expect(200)
      expect(pdf.headers['content-type']).toBe('application/pdf')
      expect(pdf.headers['content-disposition']).toBe(
        'attachment; filename="laporan-penjualan_2026-09-01_2026-09-30.pdf"',
      )
      expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-')

      const xlsx = await owner
        .get('/api/owner/reports/sales/export?format=xlsx&from=2026-09-01&to=2026-09-30')
        .buffer(true)
        .parse(binary)
        .expect(200)
      const book = new ExcelJS.Workbook()
      await book.xlsx.load(xlsx.body as unknown as ExcelJS.Buffer)
      const sheet = book.getWorksheet('Penjualan')!
      expect(sheet.getCell('B4').value).toBe(1000000)
      const codes = sheet
        .getColumn(2)
        .values.filter((v) => typeof v === 'string' && v.startsWith('INV-'))
      expect(codes).toHaveLength(3)
      await owner
        .get('/api/owner/reports/sales/export?format=csv&from=2026-09-01&to=2026-09-30')
        .expect(400)
    })
  })

  describe('dashboard dan performa (relatif terhadap sekarang)', () => {
    beforeAll(async () => {
      await prisma.order.deleteMany()
      await prisma.product.deleteMany()
      const now = Date.now()
      await sale({
        verifiedAt: new Date(now - 60_000),
        price: 400000,
        brandId: nike,
        sizeEu: 42,
        daysInCatalog: 4,
      })
      await sale({
        verifiedAt: new Date(now - 120_000),
        price: 300000,
        brandId: nike,
        sizeEu: 43,
        daysInCatalog: 8,
      })
      await sale({
        verifiedAt: new Date(now - 180_000),
        price: 200000,
        brandId: adidas,
        sizeEu: 42,
        daysInCatalog: 12,
      })
      // stok lama yang belum laku
      await prisma.product.create({
        data: {
          code: 'SSB-OLD',
          model: 'Suede',
          price: 220000,
          status: 'AVAILABLE',
          sizeEu: 45,
          condition: 'GOOD',
          brandId: adidas,
          categoryId: basket,
          createdAt: new Date(now - 44 * DAY_MS),
        },
      })
      await prisma.activityLog.create({
        data: {
          actorId: staffId,
          action: 'PAYMENT_ACCEPTED',
          entityType: 'Order',
          entityId: 'INV-X',
        },
      })
    })

    it('dashboard: KPI bulan ini, grafik, merek, ukuran, aktivitas', async () => {
      const res = await owner.get('/api/owner/dashboard?granularity=day').expect(200)
      expect(res.body.kpis).toMatchObject({
        revenue: 900000,
        sold: 3,
        available: 1,
        activeOrders: 0,
      })
      expect(res.body.chart.points).toHaveLength(14)
      expect(res.body.chart.points.at(-1).revenue).toBe(900000)
      expect(res.body.statusCounts.completed).toBe(3)
      expect(res.body.topBrands).toEqual([
        { name: 'Nike', sold: 2 },
        { name: 'Adidas', sold: 1 },
      ])
      expect(res.body.sizes).toEqual([
        { sizeEu: 42, sold: 2 },
        { sizeEu: 43, sold: 1 },
      ])
      expect(res.body.recentActivity[0]).toMatchObject({
        actorName: 'Andi',
        action: 'PAYMENT_ACCEPTED',
      })
      const weeks = (await owner.get('/api/owner/dashboard?granularity=week').expect(200)).body
        .chart.points
      expect(weeks).toHaveLength(8)
      expect(weeks[0].label).toMatch(/^M\d+$/)
      await owner.get('/api/owner/dashboard?granularity=year').expect(400)
    })

    it('performa: rata-rata lama terjual, per merek/ukuran, stok > 30 hari', async () => {
      const res = await owner.get('/api/owner/reports/performance?period=3m').expect(200)
      expect(res.body).toMatchObject({
        sold: 3,
        averageDaysToSell: 8,
        fastestCategory: { name: 'Basket', averageDays: 8 },
      })
      expect(res.body.byBrand).toEqual([
        { name: 'Nike', sold: 2, averagePrice: 350000, averageDays: 6 },
        { name: 'Adidas', sold: 1, averagePrice: 200000, averageDays: 12 },
      ])
      expect(res.body.bySize).toEqual([
        { sizeEu: 42, sold: 2 },
        { sizeEu: 43, sold: 1 },
      ])
      expect(res.body.slowMoving).toEqual({
        total: 1,
        items: [
          {
            id: expect.any(Number),
            code: 'SSB-OLD',
            photoUrl: null,
            name: 'Adidas Suede',
            sizeEu: 45,
            price: 220000,
            days: 44,
          },
        ],
      })
    })
  })
})
