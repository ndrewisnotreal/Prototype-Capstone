import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

// Alur utama (T-7.3): daftar → checkout → upload bukti → pegawai terima → siap diambil → selesai.
// Sepatu dan akun customer dibuat baru tiap run, jadi test bisa diulang tanpa reset database.
const STAFF = { email: 'pegawai1@ssb.test', password: 'ssb-demo-123' }
// Cukup magic bytes PNG: API memeriksa tipe file dari isinya
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
])
const PRICE = 350_000

async function apiJson<T>(request: APIRequestContext, path: string): Promise<T> {
  const res = await request.get(path)
  expect(res.ok(), `GET ${path}`).toBe(true)
  return (await res.json()) as T
}

/** Pegawai menambah sepatu baru (Tersedia) lewat API panel, mengembalikan kode SSB-xxxx. */
async function createProduct(request: APIRequestContext, model: string): Promise<string> {
  const login = await request.post('/api/auth/login', { data: STAFF })
  expect(login.ok(), 'login pegawai (jalankan db:seed)').toBe(true)
  const [brands, categories] = await Promise.all([
    apiJson<{ id: number }[]>(request, '/api/catalog/brands'),
    apiJson<{ id: number }[]>(request, '/api/catalog/categories'),
  ])
  const form = new FormData()
  for (const [key, value] of Object.entries({
    brandId: brands[0].id,
    categoryId: categories[0].id,
    model,
    sizeEu: 42,
    condition: 'LIKE_NEW',
    price: PRICE,
  }))
    form.append(key, String(value))
  for (let i = 1; i <= 3; i++)
    form.append('photos', new Blob([PNG], { type: 'image/png' }), `foto-${i}.png`)

  const res = await request.post('/api/panel/products', { multipart: form })
  expect(res.ok(), `buat produk: ${await res.text()}`).toBe(true)
  return ((await res.json()) as { code: string }).code
}

async function staffLogin(page: Page) {
  await page.goto('/masuk')
  await page.getByLabel('Email').fill(STAFF.email)
  await page.getByLabel('Password', { exact: true }).fill(STAFF.password)
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page).toHaveURL(/\/panel\/dashboard/)
}

test('customer baru membeli sepatu sampai pesanan selesai diambil di toko', async ({
  page,
  browser,
  request,
}) => {
  const stamp = Date.now()
  const model = `E2E Runner ${stamp}`
  const productCode = await createProduct(request, model)

  await test.step('customer mendaftar', async () => {
    await page.goto('/daftar')
    await page.getByLabel('Nama lengkap').fill('Rina E2E')
    await page.getByLabel('Email').fill(`e2e-${stamp}@ssb.test`)
    await page.getByLabel('No. WhatsApp').fill(`0812${String(stamp).slice(-8)}`)
    await page.getByLabel('Password', { exact: true }).fill('rahasia-e2e-123')
    await page.getByRole('button', { name: 'Daftar' }).click()
    await expect(page).toHaveURL('/')
  })

  let orderCode = ''
  await test.step('checkout: sepatu direservasi, pesanan menunggu pembayaran', async () => {
    await page.goto(`/sepatu/${productCode}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(model)
    await page.getByRole('button', { name: 'Beli Sekarang' }).first().click()
    await expect(page).toHaveURL(/\/checkout/)

    await page.getByLabel(/Ambil di toko/).check()
    await page.locator('#agree').check()
    await page.getByRole('button', { name: 'Buat Pesanan' }).first().click()

    await expect(page).toHaveURL(/\/pesanan\/(INV-\d{8}-\d{4})\/bayar/)
    orderCode = page.url().match(/INV-\d{8}-\d{4}/)![0]
    await expect(page.getByText('Rp 350.000').first()).toBeVisible()

    const product = await apiJson<{ status: string }>(request, `/api/products/${productCode}`)
    expect(product.status).toBe('RESERVED')
  })

  await test.step('customer mengunggah bukti transfer', async () => {
    await page
      .getByRole('link', { name: /Upload Bukti/ })
      .first()
      .click()
    await expect(page).toHaveURL(new RegExp(`/pesanan/${orderCode}/upload-bukti`))
    await page
      .locator('input[type=file]')
      .first()
      .setInputFiles({ name: 'bukti.png', mimeType: 'image/png', buffer: PNG })
    await page.getByLabel('Nama pengirim di rekening').fill('Rina E2E')
    await page.getByRole('combobox', { name: 'Bank atau e-wallet asal' }).fill('BC')
    await page.getByRole('option', { name: 'BCA', exact: true }).click()
    await page.getByRole('button', { name: 'Kirim bukti' }).click()
    await expect(page.getByRole('heading', { name: 'Bukti terkirim' })).toBeVisible()
  })

  const staffContext = await browser.newContext()
  const staff = await staffContext.newPage()
  await test.step('pegawai menerima pembayaran', async () => {
    await staffLogin(staff)
    await staff.goto(`/panel/verifikasi?kode=${orderCode}`)
    await expect(staff.getByText(orderCode).first()).toBeVisible()
    await staff.locator('#funds').check()
    await staff.getByRole('button', { name: 'Terima pembayaran' }).click()
    await expect(staff.getByText(orderCode)).toHaveCount(0)

    const product = await apiJson<{ status: string }>(request, `/api/products/${productCode}`)
    expect(product.status).toBe('SOLD')
  })

  await test.step('pegawai menandai siap diambil lalu selesai', async () => {
    await staff.goto(`/panel/pesanan?q=${orderCode}`)
    const drawer = staff.getByRole('dialog')
    await expect(drawer).toContainText(orderCode)
    await drawer.getByRole('button', { name: 'Tandai Siap Diambil' }).click()
    await expect(drawer.getByText('Siap Diambil').first()).toBeVisible()
    await drawer.getByRole('button', { name: 'Tandai Selesai' }).click()
    await expect(drawer.getByText('Selesai').first()).toBeVisible()
  })
  await staffContext.close()

  await test.step('customer melihat pesanan selesai dan bisa mengunduh invoice', async () => {
    await page.goto(`/pesanan/${orderCode}`)
    await expect(page.getByText('Selesai').first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Unduh Invoice/ }).first()).toBeVisible()
  })
})
