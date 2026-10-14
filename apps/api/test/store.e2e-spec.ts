import 'reflect-metadata'
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module.js'
import { setupApp } from '../src/app.setup.js'
import { PrismaService } from '../src/prisma/prisma.service.js'

describe('Kanal resmi (e2e, database schema e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  const get = () => request(app.getHttpServer()).get('/api/store/official-channels')

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = setupApp(moduleRef.createNestApplication())
    await app.init()
    prisma = app.get(PrismaService)
    await prisma.$executeRawUnsafe('TRUNCATE "StoreSetting", "BankAccount" RESTART IDENTITY')
  })

  afterAll(() => app.close())

  it('404 jelas kalau owner belum mengisi info toko', async () => {
    const res = await get().expect(404)
    expect(res.body.code).toBe('STORE_SETTINGS_MISSING')
  })

  it('publik, hanya rekening aktif sesuai urutan owner', async () => {
    await prisma.storeSetting.create({
      data: {
        whatsapp: '+62 895-3837-13434',
        instagram: '@suwandi.sb',
        address: 'Jl. Contoh No. 1, Medan',
        openingHours: [{ days: 'Senin-Sabtu', hours: '10.00-21.00' }],
        paymentDeadlineHours: 12,
      },
    })
    await prisma.bankAccount.createMany({
      data: [
        { bankName: 'BRI', accountNumber: '222', accountName: 'Suwandi', sortOrder: 2 },
        {
          bankName: 'Lama',
          accountNumber: '999',
          accountName: 'Suwandi',
          isActive: false,
          sortOrder: 0,
        },
        { bankName: 'BCA', accountNumber: '111', accountName: 'Suwandi', sortOrder: 1 },
      ],
    })

    const res = await get().expect(200)
    expect(res.body).toMatchObject({
      whatsapp: '+62 895-3837-13434',
      instagram: '@suwandi.sb',
      tiktok: null,
      openingHours: [{ days: 'Senin-Sabtu', hours: '10.00-21.00' }],
      paymentDeadlineHours: 12,
      fulfillmentMethods: ['PICKUP', 'SHIPPING'],
      updatedAt: expect.any(String),
    })
    expect(res.body.bankAccounts.map((b: { bankName: string }) => b.bankName)).toEqual([
      'BCA',
      'BRI',
    ])
    expect(res.body.bankAccounts[0]).toEqual({
      id: expect.any(Number),
      bankName: 'BCA',
      accountNumber: '111',
      accountName: 'Suwandi',
    })
  })
})
