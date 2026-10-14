// Data contoh untuk development (npm run db:seed -w apps/api). Menghapus SEMUA data lalu mengisi ulang.
// Dijalankan langsung oleh Node (type stripping), jadi hanya pakai sintaks TS yang bisa dibuang: tanpa enum/namespace.
import { copyFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient, type Condition, type OrderStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

if (process.env.NODE_ENV === 'production')
  throw new Error('Seed menghapus semua data, tidak boleh di production')

const prisma = new PrismaClient()
const DEMO_PASSWORD = 'ssb-demo-123'
const DAY = 24 * 60 * 60 * 1000
const now = Date.now()

const CONDITION: Record<string, Condition> = {
  'Like New': 'LIKE_NEW',
  'Sangat Baik': 'VERY_GOOD',
  Baik: 'GOOD',
  'Layak Pakai': 'FAIR',
}

// Dari layar Katalog (docs/design/screens/customer/Katalog.dc.html)
const catalog = [
  ['Nike', 'Air Jordan 1 High "Green"', 43, 'Sangat Baik', 300000, 'Basket', 'new'],
  ['New Balance', '550 White Green', 41, 'Sangat Baik', 450000, 'Sneakers', 'new'],
  ['New Balance', '2002R Rain Cloud', 44, 'Like New', 750000, 'Running', 'new'],
  ['Nike', 'Kobe', 43, 'Baik', 320000, 'Basket', ''],
  ['Nike', 'Air Max 720', 42, 'Like New', 280000, 'Running', 'reserved'],
  ['Adidas', 'Ultraboost 22', 42, 'Sangat Baik', 520000, 'Running', ''],
  ['Nike', 'Air Force 1 Low', 42, 'Baik', 350000, 'Sneakers', ''],
  ['Adidas', 'Gazelle Indoor', 43, 'Sangat Baik', 400000, 'Casual', ''],
  ['Converse', 'Chuck 70 Hi', 40, 'Baik', 250000, 'Casual', ''],
  ['Nike', 'Air Max 94', 44, 'Baik', 330000, 'Running', 'reserved'],
  ['Vans', 'Old Skool', 41, 'Layak Pakai', 180000, 'Casual', ''],
  ['Puma', 'Suede Classic', 42, 'Baik', 220000, 'Casual', ''],
] as const

// Dari blok "Baru terjual" layar Main: [merek, model, ukuran, kondisi, harga, kategori, terjual N hari lalu]
const sold = [
  ['Adidas', 'Samba OG', 42, 'Sangat Baik', 420000, 'Casual', 2],
  ['Nike', 'Air Force 1 "Cloth"', 42, 'Baik', 310000, 'Sneakers', 3],
  ['Converse', 'Chuck 70', 40, 'Baik', 240000, 'Casual', 4],
  ['Nike', 'Air Max 94', 44, 'Baik', 330000, 'Running', 5],
  ['Vans', 'Old Skool', 41, 'Layak Pakai', 170000, 'Casual', 6],
] as const

// Foto contoh (Unsplash License, sumber di prisma/seed-photos/CREDITS.md), urutan sama dengan `catalog` dan `sold`.
// Hanya untuk demo: foto bukan sepatu yang sebenarnya dijual. Di toko asli setiap sepatu difoto sendiri lewat panel.
const catalogPhotos = [
  ['air-jordan-1-high-green'],
  ['new-balance-550'],
  ['new-balance-2002r'],
  ['nike-kobe'],
  ['nike-air-max-720'],
  ['adidas-ultraboost-1', 'adidas-ultraboost-2'],
  ['nike-air-force-1-low-1', 'nike-air-force-1-low-2', 'nike-air-force-1-low-3'],
  ['adidas-gazelle'],
  ['converse-chuck-70-hi-1', 'converse-chuck-70-hi-2'],
  ['nike-air-max-94'],
  ['vans-old-skool'],
  ['puma-suede-classic'],
]
const soldPhotos = [
  ['adidas-samba-og'],
  ['nike-air-force-1-cloth'],
  ['converse-chuck-70'],
  ['nike-air-max-94-sold'],
  ['vans-old-skool-sold'],
]
const SEED_PHOTO_DIR = fileURLToPath(new URL('./seed-photos/', import.meta.url))
// Sama dengan productPhotoDir() di API: UPLOAD_DIR relatif terhadap apps/api
const PRODUCT_PHOTO_DIR = join(resolve(process.env.UPLOAD_DIR ?? 'uploads'), 'products')

async function main() {
  // Urutan hapus mengikuti foreign key
  await prisma.$transaction([
    prisma.orderStatusHistory.deleteMany(),
    prisma.paymentProof.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.productPhoto.deleteMany(),
    prisma.product.deleteMany(),
    prisma.brand.deleteMany(),
    prisma.category.deleteMany(),
    prisma.address.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.activityLog.deleteMany(),
    prisma.user.deleteMany(),
    prisma.bankAccount.deleteMany(),
    prisma.faq.deleteMany(),
    prisma.storeSetting.deleteMany(),
  ])

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const user = (
    name: string,
    email: string,
    role: 'OWNER' | 'STAFF' | 'CUSTOMER',
    phone?: string,
  ) => prisma.user.create({ data: { name, email, role, phone, passwordHash } })
  const owner = await user('Pak Suwandi', 'owner@ssb.test', 'OWNER')
  const staff = await user('Pegawai Satu', 'pegawai1@ssb.test', 'STAFF')
  await user('Pegawai Dua', 'pegawai2@ssb.test', 'STAFF')
  const customers = [
    await user('Rina Customer', 'customer1@ssb.test', 'CUSTOMER', '081200000001'),
    await user('Budi Customer', 'customer2@ssb.test', 'CUSTOMER', '081200000002'),
    await user('Sari Customer', 'customer3@ssb.test', 'CUSTOMER', '081200000003'),
  ]
  await prisma.address.create({
    data: {
      userId: customers[0].id,
      label: 'Rumah',
      line: 'Jl. Contoh No. 1',
      city: 'Medan',
      postalCode: '20111',
      isPrimary: true,
    },
  })

  const brandIds = new Map<string, number>()
  for (const name of ['Nike', 'Adidas', 'New Balance', 'Converse', 'Vans', 'Puma']) {
    brandIds.set(name, (await prisma.brand.create({ data: { name } })).id)
  }
  const categoryIds = new Map<string, number>()
  for (const name of ['Sneakers', 'Running', 'Basket', 'Casual']) {
    categoryIds.set(
      name,
      (await prisma.category.create({ data: { name, slug: name.toLowerCase() } })).id,
    )
  }

  let seq = 0
  const createProduct = (
    [brand, model, size, cond, price, category]: readonly [
      string,
      string,
      number,
      string,
      number,
      string,
      ...unknown[],
    ],
    extra: { status?: 'AVAILABLE' | 'RESERVED' | 'SOLD'; createdAt?: Date; soldAt?: Date } = {},
  ) =>
    prisma.product.create({
      data: {
        code: `SSB-${String(++seq).padStart(4, '0')}`,
        brandId: brandIds.get(brand)!,
        categoryId: categoryIds.get(category)!,
        model,
        sizeEu: size,
        insoleCm: Math.round(((size * 2) / 3) * 10) / 10, // perkiraan kasar dari ukuran EU
        condition: CONDITION[cond],
        defects:
          cond === 'Baik' || cond === 'Layak Pakai'
            ? 'Sol bagian tumit mulai tipis\nAda noda kecil di sisi kanan'
            : null,
        hasBox: cond === 'Like New',
        hasOriginalInsole: cond !== 'Layak Pakai',
        hasOriginalLaces: true,
        price,
        createdById: staff.id,
        ...extra,
      },
    })

  // Nama file tetap (seed-*.webp): seed ulang menimpa file yang sama, tidak menumpuk
  await mkdir(PRODUCT_PHOTO_DIR, { recursive: true })
  const attachPhotos = async (productId: number, names: readonly string[] = []) => {
    for (const name of names)
      await copyFile(
        join(SEED_PHOTO_DIR, `${name}.webp`),
        join(PRODUCT_PHOTO_DIR, `seed-${name}.webp`),
      )
    await prisma.productPhoto.createMany({
      data: names.map((name, i) => ({
        productId,
        url: `/api/uploads/products/seed-${name}.webp`,
        sortOrder: i,
        isPrimary: i === 0,
      })),
    })
  }

  const reserved: { p: Awaited<ReturnType<typeof createProduct>>; brand: string }[] = []
  for (const [i, row] of catalog.entries()) {
    const isNew = row[6] === 'new'
    const p = await createProduct(row, {
      status: row[6] === 'reserved' ? 'RESERVED' : 'AVAILABLE',
      createdAt: new Date(now - (isNew ? 1 : 10 + i) * DAY),
    })
    await attachPhotos(p.id, catalogPhotos[i])
    if (p.status === 'RESERVED') reserved.push({ p, brand: row[0] })
  }

  // Kode pesanan INV-YYYYMMDD-NNNN, urut per hari WIB
  const perDay = new Map<string, number>()
  const orderCode = (at: Date) => {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' })
      .format(at)
      .replaceAll('-', '')
    const n = (perDay.get(day) ?? 0) + 1
    perDay.set(day, n)
    return `INV-${day}-${String(n).padStart(4, '0')}`
  }
  const snapshot = (p: Awaited<ReturnType<typeof createProduct>>, brand: string) => ({
    productId: p.id,
    price: p.price,
    brandName: brand,
    model: p.model,
    sizeEu: p.sizeEu,
    condition: p.condition,
  })
  const history = (path: OrderStatus[], start: Date, actorId: number) =>
    path.map((toStatus, i) => ({
      fromStatus: i === 0 ? null : path[i - 1],
      toStatus,
      actorId: i === 0 ? null : actorId,
      createdAt: new Date(start.getTime() + i * 60 * 60 * 1000),
    }))

  // Sepatu RESERVED harus punya pesanan aktif, kalau tidak reservasinya tidak pernah kedaluwarsa
  const createdAt = new Date(now - 2 * 60 * 60 * 1000)
  await prisma.order.create({
    data: {
      code: orderCode(createdAt),
      customerId: customers[0].id,
      fulfillment: 'PICKUP',
      recipientName: customers[0].name,
      recipientPhone: customers[0].phone!,
      totalAmount: reserved.reduce((sum, r) => sum + r.p.price, 0),
      createdAt,
      expiresAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
      items: { create: reserved.map((r) => snapshot(r.p, r.brand)) },
      history: { create: history(['AWAITING_PAYMENT'], createdAt, customers[0].id) },
    },
  })

  for (const [i, row] of sold.entries()) {
    const soldAt = new Date(now - row[6] * DAY)
    const orderAt = new Date(soldAt.getTime() - DAY)
    const customer = customers[i % customers.length]
    const p = await createProduct(row, {
      status: 'SOLD',
      createdAt: new Date(now - 30 * DAY),
      soldAt,
    })
    await attachPhotos(p.id, soldPhotos[i])
    await prisma.order.create({
      data: {
        code: orderCode(orderAt),
        customerId: customer.id,
        status: 'COMPLETED',
        paymentStatus: 'VERIFIED',
        fulfillment: 'PICKUP',
        recipientName: customer.name,
        recipientPhone: customer.phone!,
        totalAmount: p.price,
        createdAt: orderAt,
        expiresAt: new Date(orderAt.getTime() + 24 * 60 * 60 * 1000),
        processedById: staff.id,
        items: { create: [snapshot(p, row[0])] },
        history: {
          create: history(
            [
              'AWAITING_PAYMENT',
              'AWAITING_VERIFICATION',
              'PROCESSING',
              'READY_FOR_PICKUP',
              'COMPLETED',
            ],
            orderAt,
            staff.id,
          ),
        },
      },
    })
  }

  // Kanal resmi: placeholder sampai owner mengisi di Pengaturan (jangan isi rekening/WA karangan)
  const TODO = '[isi oleh owner]'
  await prisma.storeSetting.create({
    data: { whatsapp: TODO, address: TODO, openingHours: [{ days: TODO, hours: TODO }] },
  })
  await prisma.bankAccount.createMany({
    data: [0, 1].map((sortOrder) => ({
      bankName: TODO,
      accountNumber: TODO,
      accountName: TODO,
      sortOrder,
    })),
  })
  await prisma.faq.createMany({
    data: [
      {
        question: 'Berapa lama batas waktu pembayaran?',
        answer:
          'Kamu punya 24 jam setelah checkout untuk transfer dan mengunggah bukti. Lewat dari itu, pesanan batal otomatis dan sepatunya kembali dijual.',
      },
      {
        question: 'Sepatu bisa diambil di toko atau dikirim?',
        answer:
          'Bisa dua-duanya. Pilih "Ambil di toko" atau "Kirim lewat ekspedisi" saat checkout.',
      },
      {
        question: 'Ke rekening mana saya harus transfer?',
        answer:
          'Hanya ke rekening yang tampil di halaman instruksi pembayaran dan halaman Kanal Resmi. Kami tidak pernah meminta transfer ke rekening lain lewat chat.',
      },
    ].map((f, sortOrder) => ({ ...f, sortOrder })),
  })

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.order.count(),
  ])
  console.log(`Seed selesai: ${counts[0]} akun, ${counts[1]} produk, ${counts[2]} pesanan.`)
  console.log(
    `Akun demo (password "${DEMO_PASSWORD}"): ${owner.email}, pegawai1@ssb.test, pegawai2@ssb.test, customer1-3@ssb.test`,
  )
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
