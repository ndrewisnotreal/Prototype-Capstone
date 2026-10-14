import 'reflect-metadata'
import { existsSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import bcrypt from 'bcryptjs'
import request from 'supertest'
import { AppModule } from '../src/app.module.js'
import { setupApp } from '../src/app.setup.js'
import { productPhotoDir } from '../src/modules/files/storage.service.js'
import { PrismaService } from '../src/prisma/prisma.service.js'

// Cukup byte awal yang benar: StorageService mengenali jenis file dari magic bytes
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
])
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)])
const PASSWORD = 'rahasia-123'

describe('Produk panel (e2e, database schema e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let staff: ReturnType<typeof request.agent>
  let staffId: number
  let brandId: number
  let categoryId: number

  const fields = (overrides: Record<string, string> = {}) => ({
    brandId: String(brandId),
    categoryId: String(categoryId),
    model: 'Air Force 1 Low',
    sizeEu: '42.5',
    sizeUk: '8',
    sizeUs: '',
    condition: 'GOOD',
    defects: 'Creasing ringan\nSol tipis',
    hasBox: 'true',
    price: '350000',
    ...overrides,
  })
  /** POST multipart: field + n foto */
  const createProduct = (n: number, overrides: Record<string, string> = {}, file = PNG) => {
    let req = staff.post('/api/panel/products')
    for (const [k, v] of Object.entries(fields(overrides))) req = req.field(k, v)
    for (let i = 0; i < n; i++) req = req.attach('photos', file, `foto-${i}.png`)
    return req
  }
  const lastLog = () => prisma.activityLog.findFirstOrThrow({ orderBy: { id: 'desc' } })
  const uploadedFiles = () =>
    existsSync(productPhotoDir()) ? readdirSync(productPhotoDir()).length : 0

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = setupApp(moduleRef.createNestApplication())
    await app.init()
    prisma = app.get(PrismaService)
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Product", "Brand", "Category", "User", "ActivityLog" RESTART IDENTITY CASCADE',
    )
    const passwordHash = await bcrypt.hash(PASSWORD, 4)
    staffId = (
      await prisma.user.create({
        data: { name: 'Pegawai', email: 'staff@e2e.test', role: 'STAFF', passwordHash },
      })
    ).id
    await prisma.user.create({
      data: { name: 'Customer', email: 'cust@e2e.test', role: 'CUSTOMER', passwordHash },
    })
    brandId = (await prisma.brand.create({ data: { name: 'Nike' } })).id
    categoryId = (await prisma.category.create({ data: { name: 'Sneakers', slug: 'sneakers' } })).id

    staff = request.agent(app.getHttpServer())
    await staff
      .post('/api/auth/login')
      .send({ email: 'staff@e2e.test', password: PASSWORD })
      .expect(200)
  })

  afterAll(() => app.close())

  it('hanya STAFF/OWNER: tamu 401, customer 403', async () => {
    await request(app.getHttpServer()).get('/api/panel/products').expect(401)
    const customer = request.agent(app.getHttpServer())
    await customer.post('/api/auth/login').send({ email: 'cust@e2e.test', password: PASSWORD })
    await customer.get('/api/panel/products').expect(403)
  })

  describe('tambah produk', () => {
    it('kode SSB dari id, foto pertama jadi utama, file bisa dibuka publik, log tercatat', async () => {
      const res = await createProduct(3).expect(201)
      expect(res.body).toMatchObject({
        id: 1,
        code: 'SSB-0001',
        status: 'AVAILABLE',
        sizeEu: 42.5,
        sizeUk: 8,
        sizeUs: null,
        hasBox: true,
        hasOriginalLaces: false,
        defects: ['Creasing ringan', 'Sol tipis'],
      })
      expect(res.body.photos.map((p: { isPrimary: boolean }) => p.isPrimary)).toEqual([
        true,
        false,
        false,
      ])
      expect(res.body.primaryPhotoUrl).toBe(res.body.photos[0].url)

      const file = await request(app.getHttpServer()).get(res.body.photos[0].url).expect(200)
      expect(Buffer.compare(file.body as Buffer, PNG)).toBe(0)

      expect(await lastLog()).toMatchObject({
        action: 'PRODUCT_CREATED',
        actorId: staffId,
        entityType: 'Product',
        entityId: '1',
      })
    })

    it('"Tampilkan di katalog" mati → INACTIVE dan tidak muncul di katalog publik', async () => {
      const res = await createProduct(3, { model: 'Dunk Simpanan', status: 'INACTIVE' }).expect(201)
      expect(res.body.status).toBe('INACTIVE')
      const pub = await request(app.getHttpServer()).get('/api/products?q=dunk').expect(200)
      expect(pub.body.meta.total).toBe(0)
    })

    it.each([2, 7])('%i foto ditolak, tanpa file yatim', async (n) => {
      const before = uploadedFiles()
      const res = await createProduct(n).expect(400)
      expect(res.body.code).toBe('PHOTO_COUNT')
      expect(uploadedFiles()).toBe(before)
    })

    it('file yang bukan foto ditolak walau namanya .png', async () => {
      const res = await createProduct(3, {}, Buffer.from('ini bukan gambar')).expect(400)
      expect(res.body.code).toBe('INVALID_IMAGE')
    })

    it('foto lebih dari 5 MB → 413 dengan pesan Indonesia', async () => {
      const big = Buffer.concat([JPG, Buffer.alloc(5 * 1024 * 1024)])
      const res = await createProduct(3, {}, big).expect(413)
      expect(res.body.code).toBe('FILE_TOO_LARGE')
    })

    it('validasi field dan merek yang tidak ada', async () => {
      const bad = await createProduct(3, { model: '', sizeEu: '42.25', price: '500' }).expect(400)
      expect(bad.body.details.errors).toEqual(
        expect.arrayContaining([
          'Nama atau model 2 sampai 120 karakter',
          'Ukuran EU harus angka, contoh 42 atau 42.5',
          'Harga minimal Rp 1.000',
        ]),
      )
      const res = await createProduct(3, { brandId: '999' }).expect(400)
      expect(res.body.code).toBe('RELATION_NOT_FOUND')
    })
  })

  it('daftar panel memuat semua status dan bisa difilter', async () => {
    const all = await staff.get('/api/panel/products').expect(200)
    expect(all.body.meta.total).toBe(2)
    const inactive = await staff.get('/api/panel/products?status=INACTIVE').expect(200)
    expect(inactive.body.data.map((p: { code: string }) => p.code)).toEqual(['SSB-0002'])
  })

  it('jumlah per status untuk tab dan urutan harga', async () => {
    const counts = await staff.get('/api/panel/products/status-counts').expect(200)
    expect(counts.body).toEqual({ all: 2, AVAILABLE: 1, RESERVED: 0, SOLD: 0, INACTIVE: 1 })
    await prisma.product.update({ where: { id: 2 }, data: { price: 999000 } })
    const asc = await staff.get('/api/panel/products?sort=price_asc').expect(200)
    expect(asc.body.data.map((p: { code: string }) => p.code)).toEqual(['SSB-0001', 'SSB-0002'])
    const desc = await staff.get('/api/panel/products?sort=price_desc').expect(200)
    expect(desc.body.data.map((p: { code: string }) => p.code)).toEqual(['SSB-0002', 'SSB-0001'])
  })

  describe('edit dan status', () => {
    it('ubah harga tercatat PRICE_CHANGED hanya dengan field yang berubah', async () => {
      const res = await staff
        .patch('/api/panel/products/1')
        .send({ price: 375000, sizeUk: null })
        .expect(200)
      expect(res.body).toMatchObject({ price: 375000, sizeUk: null })
      expect(await lastLog()).toMatchObject({
        action: 'PRICE_CHANGED',
        before: { price: 350000, sizeUk: 8 },
        after: { price: 375000, sizeUk: null },
      })
    })

    it('sepatu RESERVED/SOLD: harga dan status terkunci, field lain tetap bisa diedit', async () => {
      await prisma.product.update({ where: { id: 1 }, data: { status: 'RESERVED' } })
      const price = await staff.patch('/api/panel/products/1').send({ price: 1000000 }).expect(409)
      expect(price.body.code).toBe('PRODUCT_LOCKED')
      await staff.patch('/api/panel/products/1').send({ description: 'Colorway putih' }).expect(200)
      await staff.patch('/api/panel/products/1/status').send({ status: 'INACTIVE' }).expect(409)

      await prisma.product.update({ where: { id: 1 }, data: { status: 'SOLD' } })
      await staff.patch('/api/panel/products/1/status').send({ status: 'AVAILABLE' }).expect(409)
      await prisma.product.update({ where: { id: 1 }, data: { status: 'AVAILABLE' } })
    })

    it('AVAILABLE ↔ INACTIVE dengan log, status lain ditolak validasi', async () => {
      const res = await staff
        .patch('/api/panel/products/1/status')
        .send({ status: 'INACTIVE' })
        .expect(200)
      expect(res.body.status).toBe('INACTIVE')
      expect(await lastLog()).toMatchObject({
        action: 'PRODUCT_STATUS_CHANGED',
        before: { status: 'AVAILABLE' },
        after: { status: 'INACTIVE' },
      })
      await staff.patch('/api/panel/products/1/status').send({ status: 'AVAILABLE' }).expect(200)
      await staff.patch('/api/panel/products/1/status').send({ status: 'SOLD' }).expect(400)
    })
  })

  it('produk tanpa foto (data lama): foto pertama yang ditambah jadi utama', async () => {
    const bare = await prisma.product.create({
      data: {
        code: 'SSB-LAMA',
        brandId,
        categoryId,
        model: 'Tanpa Foto',
        sizeEu: 41,
        condition: 'GOOD',
        price: 100000,
      },
    })
    const res = await staff
      .post(`/api/panel/products/${bare.id}/photos`)
      .attach('photos', PNG, 'a.png')
      .attach('photos', JPG, 'b.jpg')
      .expect(201)
    expect(res.body.photos.map((p: { isPrimary: boolean }) => p.isPrimary)).toEqual([true, false])
    await prisma.product.delete({ where: { id: bare.id } })
  })

  describe('foto', () => {
    const photoIds = async () =>
      (await staff.get('/api/panel/products/1').expect(200)).body.photos as {
        id: number
        url: string
        isPrimary: boolean
      }[]

    it('tambah sampai 6, lebih dari itu ditolak', async () => {
      await staff
        .post('/api/panel/products/1/photos')
        .attach('photos', JPG, 'a.jpg')
        .attach('photos', JPG, 'b.jpg')
        .attach('photos', PNG, 'c.png')
        .expect(201)
      expect(await photoIds()).toHaveLength(6)
      const res = await staff
        .post('/api/panel/products/1/photos')
        .attach('photos', JPG, 'd.jpg')
        .expect(400)
      expect(res.body.code).toBe('PHOTO_COUNT')
    })

    it('atur urutan dan foto utama; daftar yang tidak lengkap ditolak', async () => {
      const ids = (await photoIds()).map((p) => p.id)
      const reversed = [...ids].reverse()
      const res = await staff
        .patch('/api/panel/products/1/photos')
        .send({ photoIds: reversed, primaryPhotoId: ids[2] })
        .expect(200)
      expect(res.body.photos.map((p: { id: number }) => p.id)).toEqual(reversed)
      expect(res.body.photos.find((p: { isPrimary: boolean }) => p.isPrimary).id).toBe(ids[2])

      const bad = await staff
        .patch('/api/panel/products/1/photos')
        .send({ photoIds: ids.slice(1), primaryPhotoId: ids[1] })
        .expect(400)
      expect(bad.body.code).toBe('PHOTO_ORDER_INVALID')
    })

    it('hapus foto utama: foto berikutnya jadi utama, file ikut terhapus, minimal 3', async () => {
      const photos = await photoIds()
      const primary = photos.find((p) => p.isPrimary)!
      await staff.delete(`/api/panel/products/1/photos/${primary.id}`).expect(200)
      expect(existsSync(join(productPhotoDir(), basename(primary.url)))).toBe(false)
      const after = await photoIds()
      expect(after.filter((p) => p.isPrimary)).toHaveLength(1)

      await staff.delete(`/api/panel/products/1/photos/${after[0].id}`).expect(200)
      await staff.delete(`/api/panel/products/1/photos/${after[1].id}`).expect(200)
      const res = await staff.delete(`/api/panel/products/1/photos/${after[2].id}`).expect(400)
      expect(res.body.code).toBe('PHOTO_COUNT')
      expect(await photoIds()).toHaveLength(3)
    })
  })
})
