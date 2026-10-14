import 'reflect-metadata'
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { ProductStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'
import request from 'supertest'
import { AppModule } from '../src/app.module.js'
import { setupApp } from '../src/app.setup.js'
import { orderCodePrefix } from '../src/common/utils/order-code.js'
import { PrismaService } from '../src/prisma/prisma.service.js'

const PASSWORD = 'rahasia-123'
type Agent = ReturnType<typeof request.agent>

describe('Checkout + reservasi atomik (e2e, database schema e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let brandId: number
  let categoryId: number
  const customers: Agent[] = []
  const customerIds: number[] = []

  const product = async (price: number, status: ProductStatus = 'AVAILABLE') =>
    (
      await prisma.product.create({
        data: {
          code: `P-${Math.random()}`,
          model: 'Air Max',
          price,
          status,
          sizeEu: 42.5,
          condition: 'GOOD',
          brandId,
          categoryId,
        },
      })
    ).id
  const body = (productIds: number[], over: Record<string, unknown> = {}) => ({
    productIds,
    fulfillment: 'PICKUP',
    recipientName: 'Rina',
    recipientPhone: '0812 3456 7890',
    agree: true,
    ...over,
  })
  const statusOf = async (id: number) =>
    (await prisma.product.findUniqueOrThrow({ where: { id } })).status

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = setupApp(moduleRef.createNestApplication())
    await app.init()
    prisma = app.get(PrismaService)
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Product", "Brand", "Category", "User", "Order", "StoreSetting" RESTART IDENTITY CASCADE',
    )
    await prisma.storeSetting.create({
      data: {
        whatsapp: '0812',
        address: 'Medan',
        openingHours: [],
        paymentDeadlineHours: 24,
        fulfillmentMethods: ['PICKUP', 'SHIPPING'],
      },
    })
    brandId = (await prisma.brand.create({ data: { name: 'Nike' } })).id
    categoryId = (await prisma.category.create({ data: { name: 'Sneakers', slug: 'sneakers' } })).id
    const passwordHash = await bcrypt.hash(PASSWORD, 4)
    for (let i = 0; i < 5; i++) {
      const email = `c${i}@e2e.test`
      customerIds.push(
        (await prisma.user.create({ data: { name: `C${i}`, email, passwordHash } })).id,
      )
      const agent = request.agent(app.getHttpServer())
      await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200)
      customers.push(agent)
    }
  })

  afterAll(() => app.close())

  it('berhasil: sepatu RESERVED, harga disalin, keranjang dibersihkan, history, batas bayar', async () => {
    const a = await product(300000)
    const b = await product(200000)
    const other = await product(100000)
    for (const id of [a, b, other])
      await prisma.cartItem.create({ data: { userId: customerIds[0], productId: id } })

    const before = Date.now()
    const res = await customers[0]
      .post('/api/orders/checkout')
      .send(body([a, b]))
      .expect(201)
    const order = res.body.order
    expect(order).toMatchObject({
      code: `${orderCodePrefix(new Date())}0001`,
      status: 'AWAITING_PAYMENT',
      paymentStatus: 'UNPAID',
      fulfillment: 'PICKUP',
      total: 500000,
      itemCount: 2,
    })
    const hours = (Date.parse(order.expiresAt) - before) / 3_600_000
    expect(hours).toBeGreaterThan(23.99)
    expect(hours).toBeLessThan(24.01)

    expect([await statusOf(a), await statusOf(b), await statusOf(other)]).toEqual([
      'RESERVED',
      'RESERVED',
      'AVAILABLE',
    ])
    const saved = await prisma.order.findUniqueOrThrow({
      where: { code: order.code },
      include: { items: true, history: true },
    })
    expect(saved.items.map((i) => [i.price, i.brandName, Number(i.sizeEu)])).toEqual([
      [300000, 'Nike', 42.5],
      [200000, 'Nike', 42.5],
    ])
    expect(saved).toMatchObject({ recipientPhone: '081234567890', shippingAddress: null })
    expect(saved.history).toMatchObject([
      { fromStatus: null, toStatus: 'AWAITING_PAYMENT', actorId: customerIds[0] },
    ])
    // Hanya sepatu yang dibeli yang keluar dari keranjang
    const cart = await prisma.cartItem.findMany({ where: { userId: customerIds[0] } })
    expect(cart.map((c) => c.productId)).toEqual([other])

    // Harga produk yang diubah kemudian tidak mengubah total pesanan
    await prisma.product.update({ where: { id: a }, data: { price: 999000 } })
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { code: order.code } })).totalAmount,
    ).toBe(500000)
  })

  it('BENTROK: 5 customer checkout sepatu yang sama bersamaan → tepat 1 berhasil', async () => {
    const shoe = await product(450000)
    const results = await Promise.all(
      customers.map((c) => c.post('/api/orders/checkout').send(body([shoe]))),
    )
    const statuses = results.map((r) => r.status).sort()
    expect(statuses).toEqual([201, 409, 409, 409, 409])
    for (const r of results.filter((r) => r.status === 409)) {
      expect(r.body).toMatchObject({
        code: 'PRODUCT_NOT_AVAILABLE',
        details: { unavailableProductIds: [shoe] },
      })
    }
    expect(await statusOf(shoe)).toBe('RESERVED')
    expect(await prisma.orderItem.count({ where: { productId: shoe } })).toBe(1)
  })

  it('checkout bersamaan untuk sepatu berbeda: semua berhasil dengan kode berbeda', async () => {
    const shoes = await Promise.all(customers.map(() => product(100000)))
    const results = await Promise.all(
      customers.map((c, i) => c.post('/api/orders/checkout').send(body([shoes[i]]))),
    )
    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201])
    const codes = results.map((r) => r.body.order.code as string)
    expect(new Set(codes).size).toBe(5)
  })

  it('satu dari dua sudah dipesan → seluruh checkout batal, yang lain tetap AVAILABLE', async () => {
    const free = await product(100000)
    const taken = await product(100000, 'RESERVED')
    const res = await customers[1]
      .post('/api/orders/checkout')
      .send(body([free, taken]))
      .expect(409)
    expect(res.body.details.unavailableProductIds).toEqual([taken])
    expect(await statusOf(free)).toBe('AVAILABLE')
  })

  it('sepatu yang tidak ada ikut ditandai tidak tersedia', async () => {
    const res = await customers[1]
      .post('/api/orders/checkout')
      .send(body([99999]))
      .expect(409)
    expect(res.body.details.unavailableProductIds).toEqual([99999])
  })

  it('dikirim: alamat wajib dan disimpan', async () => {
    const shoe = await product(100000)
    const bad = await customers[2]
      .post('/api/orders/checkout')
      .send(body([shoe], { fulfillment: 'SHIPPING' }))
      .expect(400)
    expect(bad.body.details.errors).toContain('Alamat pengiriman 10 sampai 500 karakter')
    const res = await customers[2]
      .post('/api/orders/checkout')
      .send(body([shoe], { fulfillment: 'SHIPPING', shippingAddress: 'Jl. Contoh No. 1, Medan' }))
      .expect(201)
    const saved = await prisma.order.findUniqueOrThrow({ where: { code: res.body.order.code } })
    expect(saved.shippingAddress).toBe('Jl. Contoh No. 1, Medan')
  })

  it.each([
    [{ agree: false }, 'Setujui syarat belanja dulu untuk lanjut'],
    [{ productIds: [] }, 'Pilih minimal 1 sepatu'],
    [{ productIds: [1, 1] }, 'Sepatu yang sama tercantum dua kali'],
    [{ recipientPhone: '123' }, 'Nomor HP belum benar, contoh 081234567890'],
  ])('validasi %o', async (over, message) => {
    const res = await customers[3]
      .post('/api/orders/checkout')
      .send(body([1], over))
      .expect(400)
    expect(res.body.details.errors).toContain(message)
  })

  it('metode pengambilan yang dimatikan owner ditolak', async () => {
    await prisma.storeSetting.update({ where: { id: 1 }, data: { fulfillmentMethods: ['PICKUP'] } })
    const shoe = await product(100000)
    const res = await customers[3]
      .post('/api/orders/checkout')
      .send(body([shoe], { fulfillment: 'SHIPPING', shippingAddress: 'Jl. Contoh No. 1, Medan' }))
      .expect(400)
    expect(res.body.code).toBe('FULFILLMENT_NOT_AVAILABLE')
    expect(await statusOf(shoe)).toBe('AVAILABLE')
  })

  it('hanya CUSTOMER', async () => {
    await request(app.getHttpServer())
      .post('/api/orders/checkout')
      .send(body([1]))
      .expect(401)
  })
})
