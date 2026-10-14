import 'reflect-metadata'
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { ProductStatus } from '@prisma/client'
import request from 'supertest'
import { AppModule } from '../src/app.module.js'
import { setupApp } from '../src/app.setup.js'
import { PrismaService } from '../src/prisma/prisma.service.js'

const DAY = 24 * 60 * 60 * 1000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY)

describe('Produk publik (e2e, database schema e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  const get = (path: string) => request(app.getHttpServer()).get(`/api${path}`)
  const codes = async (path: string) => {
    const res = await get(path).expect(200)
    return (res.body.data as { code: string }[]).map((p) => p.code)
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = setupApp(moduleRef.createNestApplication())
    await app.init()
    prisma = app.get(PrismaService)

    await prisma.$executeRawUnsafe(
      'TRUNCATE "Product", "Brand", "Category" RESTART IDENTITY CASCADE',
    )
    const nike = await prisma.brand.create({ data: { name: 'Nike' } })
    const adidas = await prisma.brand.create({ data: { name: 'Adidas' } })
    const sneakers = await prisma.category.create({ data: { name: 'Sneakers', slug: 'sneakers' } })
    const running = await prisma.category.create({ data: { name: 'Running', slug: 'running' } })

    const product = (
      code: string,
      brandId: number,
      categoryId: number,
      model: string,
      sizeEu: number,
      price: number,
      status: ProductStatus,
      createdAt: Date,
      extra: object = {},
    ) =>
      prisma.product.create({
        data: {
          code,
          brandId,
          categoryId,
          model,
          sizeEu,
          price,
          status,
          createdAt,
          condition: 'GOOD',
          ...extra,
        },
      })

    await product(
      'SSB-0001',
      nike.id,
      sneakers.id,
      'Air Force 1 Low',
      42,
      350000,
      'AVAILABLE',
      daysAgo(1),
      {
        condition: 'VERY_GOOD',
        photos: {
          create: [
            { url: '/uploads/af1-samping.jpg', sortOrder: 0 },
            { url: '/uploads/af1-utama.jpg', sortOrder: 1, isPrimary: true },
          ],
        },
      },
    )
    await product(
      'SSB-0002',
      nike.id,
      running.id,
      'Air Max 720',
      43,
      280000,
      'RESERVED',
      daysAgo(10),
    )
    await product(
      'SSB-0003',
      adidas.id,
      running.id,
      'Ultraboost 22',
      42,
      520000,
      'AVAILABLE',
      daysAgo(20),
      {
        defects: 'Sol tumit tipis\n\n Noda kecil ',
        sizeUk: 8,
      },
    )
    await product('SSB-0004', adidas.id, sneakers.id, 'Samba OG', 41, 420000, 'SOLD', daysAgo(30), {
      soldAt: daysAgo(2),
    })
    await product(
      'SSB-0005',
      nike.id,
      sneakers.id,
      'Cortez Lama',
      40,
      150000,
      'SOLD',
      daysAgo(90),
      {
        soldAt: daysAgo(40), // di luar 30 hari, tidak masuk "Baru terjual"
      },
    )
    await product(
      'SSB-0006',
      nike.id,
      sneakers.id,
      'Dunk Nonaktif',
      42,
      300000,
      'INACTIVE',
      daysAgo(3),
    )
    await product(
      'SSB-0007',
      adidas.id,
      sneakers.id,
      'Gazelle Indoor',
      43,
      400000,
      'AVAILABLE',
      daysAgo(5),
    )
  })

  afterAll(() => app.close())

  describe('GET /products', () => {
    it('hanya AVAILABLE + RESERVED, terbaru dulu, dengan meta paginasi', async () => {
      const res = await get('/products').expect(200)
      expect(res.body.data.map((p: { code: string }) => p.code)).toEqual([
        'SSB-0001',
        'SSB-0007',
        'SSB-0002',
        'SSB-0003',
      ])
      expect(res.body.meta).toEqual({ page: 1, limit: 12, total: 4 })
    })

    it('bentuk ProductCardDto: foto utama, isNew, ukuran angka', async () => {
      const [first] = (await get('/products?q=SSB-0001').expect(200)).body.data
      expect(first).toEqual({
        code: 'SSB-0001',
        brand: 'Nike',
        model: 'Air Force 1 Low',
        sizeEu: 42,
        condition: 'VERY_GOOD',
        price: 350000,
        status: 'AVAILABLE',
        primaryPhotoUrl: '/uploads/af1-utama.jpg',
        isNew: true,
      })
      const [old] = (await get('/products?q=SSB-0003').expect(200)).body.data
      expect(old).toMatchObject({ isNew: false, primaryPhotoUrl: null })
    })

    it.each([
      ['hideReserved=true', ['SSB-0001', 'SSB-0007', 'SSB-0003']],
      ['brand=nike', ['SSB-0001', 'SSB-0002']],
      ['brand=Nike,Adidas', ['SSB-0001', 'SSB-0007', 'SSB-0002', 'SSB-0003']],
      ['category=running', ['SSB-0002', 'SSB-0003']],
      ['size=42', ['SSB-0001', 'SSB-0003']],
      ['size=42&size=43&brand=Adidas', ['SSB-0007', 'SSB-0003']],
      ['condition=VERY_GOOD', ['SSB-0001']],
      ['minPrice=300000&maxPrice=450000', ['SSB-0001', 'SSB-0007']],
      ['sort=price_asc', ['SSB-0002', 'SSB-0001', 'SSB-0007', 'SSB-0003']],
      ['sort=price_desc', ['SSB-0003', 'SSB-0007', 'SSB-0001', 'SSB-0002']],
      ['q=nike 42', ['SSB-0001']],
      ['q=ultraboost', ['SSB-0003']],
      ['limit=2&page=2', ['SSB-0002', 'SSB-0003']],
    ])('?%s', async (qs, expected) => {
      expect(await codes(`/products?${encodeURI(qs)}`)).toEqual(expected)
    })

    it.each(['limit=100', 'sort=termurah', 'condition=BAGUS', 'size=besar', 'page=0'])(
      '?%s ditolak 400',
      async (qs) => {
        const res = await get(`/products?${qs}`).expect(400)
        expect(res.body.code).toBe('VALIDATION_ERROR')
      },
    )
  })

  describe('GET /products/:code', () => {
    it('detail lengkap, kode huruf kecil tetap ketemu', async () => {
      const res = await get('/products/ssb-0003').expect(200)
      expect(res.body).toMatchObject({
        code: 'SSB-0003',
        sizeUk: 8,
        sizeUs: null,
        defects: ['Sol tumit tipis', 'Noda kecil'],
        photos: [],
        category: { name: 'Running', slug: 'running' },
      })
    })

    it('foto urut sortOrder dan menandai foto utama', async () => {
      const res = await get('/products/SSB-0001').expect(200)
      expect(
        res.body.photos.map((p: { url: string; isPrimary: boolean }) => [p.url, p.isPrimary]),
      ).toEqual([
        ['/uploads/af1-samping.jpg', false],
        ['/uploads/af1-utama.jpg', true],
      ])
    })

    it('SOLD tetap bisa dibuka (tampil "Terjual"), INACTIVE dan kode tak dikenal 404', async () => {
      expect((await get('/products/SSB-0004').expect(200)).body.status).toBe('SOLD')
      for (const code of ['SSB-0006', 'SSB-9999']) {
        const res = await get(`/products/${code}`).expect(404)
        expect(res.body.code).toBe('PRODUCT_NOT_FOUND')
      }
    })
  })

  it('GET /products/:code/similar: kategori sama, ukuran ±1, AVAILABLE, tanpa dirinya', async () => {
    const res = await get('/products/SSB-0001/similar').expect(200)
    expect(res.body.map((p: { code: string }) => p.code)).toEqual(['SSB-0007'])
    await get('/products/SSB-0006/similar').expect(404)
  })

  it('GET /products/recently-sold: hanya SOLD 30 hari terakhir, terbaru dulu, dengan soldAt', async () => {
    const res = await get('/products/recently-sold').expect(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toMatchObject({
      code: 'SSB-0004',
      status: 'SOLD',
      soldAt: expect.any(String),
    })
  })

  it('GET /catalog/brands dan /catalog/categories urut sesuai urutan masuk', async () => {
    expect((await get('/catalog/brands').expect(200)).body).toEqual([
      { id: 1, name: 'Nike' },
      { id: 2, name: 'Adidas' },
    ])
    expect(
      (await get('/catalog/categories').expect(200)).body.map((c: { slug: string }) => c.slug),
    ).toEqual(['sneakers', 'running'])
  })
})
