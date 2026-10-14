import 'reflect-metadata'
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { ProductStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'
import request from 'supertest'
import { AppModule } from '../src/app.module.js'
import { setupApp } from '../src/app.setup.js'
import { PrismaService } from '../src/prisma/prisma.service.js'

const PASSWORD = 'rahasia-123'

describe('Keranjang (e2e, database schema e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let customer: ReturnType<typeof request.agent>
  const ids: Record<string, number> = {}

  const login = async (email: string) => {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200)
    return agent
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = setupApp(moduleRef.createNestApplication())
    await app.init()
    prisma = app.get(PrismaService)
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Product", "Brand", "Category", "User" RESTART IDENTITY CASCADE',
    )
    const passwordHash = await bcrypt.hash(PASSWORD, 4)
    for (const [email, role] of [
      ['cust@e2e.test', 'CUSTOMER'],
      ['lain@e2e.test', 'CUSTOMER'],
      ['staff@e2e.test', 'STAFF'],
    ] as const) {
      await prisma.user.create({ data: { name: email, email, role, passwordHash } })
    }
    const brand = await prisma.brand.create({ data: { name: 'Nike' } })
    const category = await prisma.category.create({ data: { name: 'Sneakers', slug: 'sneakers' } })
    const product = (code: string, price: number, status: ProductStatus = 'AVAILABLE') =>
      prisma.product.create({
        data: {
          code,
          model: code,
          price,
          status,
          sizeEu: 42,
          condition: 'GOOD',
          brandId: brand.id,
          categoryId: category.id,
        },
      })
    ids.a = (await product('A', 300000)).id
    ids.b = (await product('B', 200000)).id
    ids.reserved = (await product('R', 100000, 'RESERVED')).id
    ids.sold = (await product('S', 100000, 'SOLD')).id
    ids.inactive = (await product('I', 100000, 'INACTIVE')).id

    customer = await login('cust@e2e.test')
  })

  afterAll(() => app.close())

  it('hanya CUSTOMER: tamu 401, pegawai 403', async () => {
    await request(app.getHttpServer()).get('/api/cart').expect(401)
    await (await login('staff@e2e.test')).get('/api/cart').expect(403)
  })

  it('keranjang awal kosong', async () => {
    expect((await customer.get('/api/cart').expect(200)).body).toEqual({
      items: [],
      availableCount: 0,
      total: 0,
    })
  })

  it('tambah sepatu tersedia, terbaru di atas, menambah ulang tidak dobel', async () => {
    await customer.post('/api/cart/items').send({ productId: ids.a }).expect(201)
    await customer.post('/api/cart/items').send({ productId: ids.b }).expect(201)
    const res = await customer.post('/api/cart/items').send({ productId: ids.a }).expect(201)
    expect(res.body.items.map((i: { code: string }) => i.code)).toEqual(['B', 'A'])
    expect(res.body).toMatchObject({ availableCount: 2, total: 500000 })
    expect(res.body.items[0]).toMatchObject({
      productId: ids.b,
      available: true,
      brand: 'Nike',
      addedAt: expect.any(String),
    })
  })

  it.each([
    ['reserved', 409, 'PRODUCT_NOT_AVAILABLE'],
    ['sold', 409, 'PRODUCT_NOT_AVAILABLE'],
    ['inactive', 404, 'PRODUCT_NOT_FOUND'],
  ])('sepatu %s tidak bisa masuk keranjang', async (key, status, code) => {
    const res = await customer.post('/api/cart/items').send({ productId: ids[key] }).expect(status)
    expect(res.body.code).toBe(code)
  })

  it('id tidak ada → 404, bukan angka → 400', async () => {
    await customer.post('/api/cart/items').send({ productId: 9999 }).expect(404)
    await customer.post('/api/cart/items').send({ productId: 'abc' }).expect(400)
  })

  it('sepatu yang lalu dipesan orang lain ditandai dan keluar dari total, tanpa dihapus', async () => {
    await prisma.product.update({ where: { id: ids.a }, data: { status: 'RESERVED' } })
    const res = await customer.get('/api/cart').expect(200)
    expect(
      res.body.items.map((i: { code: string; available: boolean }) => [i.code, i.available]),
    ).toEqual([
      ['B', true],
      ['A', false],
    ])
    expect(res.body).toMatchObject({ availableCount: 1, total: 200000 })
  })

  it('keranjang milik masing-masing customer', async () => {
    const other = await login('lain@e2e.test')
    expect((await other.get('/api/cart').expect(200)).body.items).toEqual([])
  })

  it('hapus item (aman diulang)', async () => {
    await customer.delete(`/api/cart/items/${ids.b}`).expect(200)
    const res = await customer.delete(`/api/cart/items/${ids.b}`).expect(200)
    expect(res.body.items.map((i: { code: string }) => i.code)).toEqual(['A'])
  })
})
