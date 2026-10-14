import 'reflect-metadata'
import { INestApplication, ServiceUnavailableException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import bcrypt from 'bcryptjs'
import request from 'supertest'
import { AppModule } from '../src/app.module.js'
import { setupApp } from '../src/app.setup.js'
import { MailService } from '../src/common/mail/mail.service.js'
import { PrismaService } from '../src/prisma/prisma.service.js'

const PASSWORD = 'rahasia-123'
type Agent = ReturnType<typeof request.agent>
const settings = {
  whatsapp: '0895-3837-13434',
  instagram: '@suwandi.sb',
  tiktok: '',
  address: 'Jl. Karya Wisata Ujung No. 43, Medan',
  openingHours: [{ days: 'Senin sampai Sabtu', hours: '10.00 sampai 21.00' }],
  paymentDeadlineHours: 12,
  fulfillmentMethods: ['PICKUP'],
}

describe('Owner: akun, log, pengaturan, rekening, FAQ (e2e, database schema e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let owner: Agent
  let staff: Agent
  let ownerId: number
  let rinaId: number
  const mails: { to: string; subject: string; text: string }[] = []
  let failNextMail = false

  const login = async (email: string, password = PASSWORD) => {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/api/auth/login').send({ email, password }).expect(200)
    return agent
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({
        send: (m: (typeof mails)[number]) => {
          if (failNextMail) {
            failNextMail = false
            return Promise.reject(new ServiceUnavailableException({ code: 'MAIL_FAILED' }))
          }
          mails.push(m)
          return Promise.resolve()
        },
      })
      .compile()
    app = setupApp(moduleRef.createNestApplication())
    await app.init()
    prisma = app.get(PrismaService)
    await prisma.$executeRawUnsafe(
      'TRUNCATE "User", "Order", "ActivityLog", "StoreSetting", "BankAccount", "Faq", "PasswordResetToken" RESTART IDENTITY CASCADE',
    )
    const passwordHash = await bcrypt.hash(PASSWORD, 4)
    ownerId = (
      await prisma.user.create({
        data: { name: 'Suwandi', email: 'owner@e2e.test', role: 'OWNER', passwordHash },
      })
    ).id
    await prisma.user.create({
      data: { name: 'Andi', email: 'staff@e2e.test', role: 'STAFF', passwordHash },
    })
    rinaId = (
      await prisma.user.create({
        data: { name: 'Rina', email: 'rina@e2e.test', phone: '081200000001', passwordHash },
      })
    ).id
    await prisma.storeSetting.create({
      data: {
        ...settings,
        whatsapp: '0812',
        openingHours: [],
        fulfillmentMethods: ['PICKUP', 'SHIPPING'],
      },
    })
    owner = await login('owner@e2e.test')
    staff = await login('staff@e2e.test')
  })

  afterAll(() => app.close())

  describe('akun', () => {
    it('daftar pegawai (+ owner) dan customer dengan pencarian', async () => {
      const staffList = (await owner.get('/api/owner/users?role=STAFF').expect(200)).body
      expect(staffList.data.map((u: { role: string }) => u.role).sort()).toEqual(['OWNER', 'STAFF'])
      const cust = (await owner.get('/api/owner/users?role=CUSTOMER&q=0812000').expect(200)).body
      expect(cust.data).toMatchObject([{ name: 'Rina', orderCount: 0, isActive: true }])
      await owner.get('/api/owner/users').expect(400) // role wajib
      await staff.get('/api/owner/users?role=CUSTOMER').expect(403)
    })

    it('tambah pegawai: email undangan, tautan membuat password, lalu bisa masuk', async () => {
      const res = await owner
        .post('/api/owner/users/staff')
        .send({ name: 'Maya', email: 'Maya@E2E.test', phone: '0813-7720-5561' })
        .expect(201)
      expect(res.body).toMatchObject({
        email: 'maya@e2e.test',
        role: 'STAFF',
        phone: '081377205561',
      })
      await owner
        .post('/api/owner/users/staff')
        .send({ name: 'Maya', email: 'maya@e2e.test', phone: '081377205561' })
        .expect(409)
      const invite = mails.find((m) => m.to === 'maya@e2e.test')!
      expect(invite.subject).toContain('Undangan')
      const token = /token=([a-f0-9]+)/.exec(invite.text)![1]
      await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token, password: 'maya-baru-123' })
        .expect(200)
      await login('maya@e2e.test', 'maya-baru-123')
      expect(await prisma.activityLog.count({ where: { action: 'STAFF_CREATED' } })).toBe(1)
    })

    it('email undangan gagal: akun tetap dibuat, owner diberi tahu cara mengirim ulang', async () => {
      failNextMail = true
      const res = await owner
        .post('/api/owner/users/staff')
        .send({ name: 'Doni', email: 'doni@e2e.test', phone: '081377205562' })
        .expect(503)
      expect(res.body.code).toBe('INVITE_MAIL_FAILED')
      const doni = await prisma.user.findUniqueOrThrow({ where: { email: 'doni@e2e.test' } })
      await owner.post(`/api/owner/users/${doni.id}/reset-password`).expect(204)
      expect(mails.some((m) => m.to === 'doni@e2e.test')).toBe(true)
    })

    it('nonaktifkan customer (tidak bisa masuk), reset password, owner terlindungi', async () => {
      await owner.patch(`/api/owner/users/${rinaId}`).send({ isActive: false }).expect(200)
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'rina@e2e.test', password: PASSWORD })
        .expect(403)
      expect(
        (await owner.post(`/api/owner/users/${rinaId}/reset-password`).expect(409)).body.code,
      ).toBe('ACCOUNT_INACTIVE')
      await owner.patch(`/api/owner/users/${rinaId}`).send({ isActive: true }).expect(200)
      await owner.post(`/api/owner/users/${rinaId}/reset-password`).expect(204)
      expect(mails.at(-1)).toMatchObject({
        to: 'rina@e2e.test',
        subject: expect.stringContaining('Atur ulang'),
      })
      expect(
        (await owner.patch(`/api/owner/users/${ownerId}`).send({ isActive: false }).expect(403))
          .body.code,
      ).toBe('OWNER_PROTECTED')
    })
  })

  describe('pengaturan, rekening, FAQ', () => {
    it('ubah pengaturan: tampil di kanal resmi publik dan tercatat dengan sebelum/sesudah', async () => {
      const res = await owner.put('/api/owner/settings').send(settings).expect(200)
      expect(res.body).toMatchObject({
        whatsapp: '0895383713434',
        tiktok: null,
        paymentDeadlineHours: 12,
        fulfillmentMethods: ['PICKUP'],
      })
      const pub = (
        await request(app.getHttpServer()).get('/api/store/official-channels').expect(200)
      ).body
      expect(pub).toMatchObject({ whatsapp: '0895383713434', paymentDeadlineHours: 12 })
      const log = await prisma.activityLog.findFirstOrThrow({
        where: { action: 'SETTINGS_UPDATED' },
      })
      expect(log.before).toMatchObject({ whatsapp: '0812' })
      await owner
        .put('/api/owner/settings')
        .send({ ...settings, fulfillmentMethods: [] })
        .expect(400)
      await owner
        .put('/api/owner/settings')
        .send({ ...settings, paymentDeadlineHours: 0 })
        .expect(400)
    })

    it('rekening: wajib password owner; password tidak ikut tercatat', async () => {
      const account = { bankName: 'BCA', accountNumber: '123 456 7890', accountName: 'Suwandi' }
      expect(
        (
          await owner
            .post('/api/owner/bank-accounts')
            .send({ ...account, password: 'salah-banget' })
            .expect(400)
        ).body.code,
      ).toBe('WRONG_PASSWORD')
      await owner.post('/api/owner/bank-accounts').send(account).expect(400)
      const list = (
        await owner
          .post('/api/owner/bank-accounts')
          .send({ ...account, password: PASSWORD })
          .expect(201)
      ).body
      expect(list).toMatchObject([{ bankName: 'BCA', isActive: true }])
      const id = list[0].id
      await owner
        .patch(`/api/owner/bank-accounts/${id}`)
        .send({ ...account, isActive: false, password: PASSWORD })
        .expect(200)
      const pub = (
        await request(app.getHttpServer()).get('/api/store/official-channels').expect(200)
      ).body
      expect(pub.bankAccounts).toEqual([]) // nonaktif tidak tampil di publik
      await owner
        .delete(`/api/owner/bank-accounts/${id}`)
        .send({ password: 'salah-banget' })
        .expect(400)
      expect(
        (
          await owner
            .delete(`/api/owner/bank-accounts/${id}`)
            .send({ password: PASSWORD })
            .expect(200)
        ).body,
      ).toEqual([])
      const logs = await prisma.activityLog.findMany({ where: { entityType: 'BankAccount' } })
      expect(logs.map((l) => l.action)).toEqual([
        'BANK_ACCOUNT_CREATED',
        'BANK_ACCOUNT_UPDATED',
        'BANK_ACCOUNT_DELETED',
      ])
      expect(JSON.stringify(logs)).not.toContain(PASSWORD)
      await staff.get('/api/owner/bank-accounts').expect(403)
    })

    it('FAQ: tambah, ubah, hapus', async () => {
      const created = (
        await owner
          .post('/api/owner/faqs')
          .send({ question: 'Bagaimana cara bayar?', answer: 'Transfer ke rekening resmi.' })
          .expect(201)
      ).body
      const id = created[0].id
      await owner
        .patch(`/api/owner/faqs/${id}`)
        .send({
          question: 'Bagaimana cara bayar?',
          answer: 'Transfer lalu unggah bukti.',
          isActive: false,
        })
        .expect(200)
      expect((await owner.get('/api/owner/faqs').expect(200)).body).toMatchObject([
        { answer: 'Transfer lalu unggah bukti.', isActive: false },
      ])
      expect((await owner.delete(`/api/owner/faqs/${id}`).expect(200)).body).toEqual([])
      await owner.post('/api/owner/faqs').send({ question: 'x', answer: 'y' }).expect(400)
    })
  })

  describe('log aktivitas', () => {
    it('filter pelaku/aksi/tanggal, nama pelaku, terbaru dulu, paginasi', async () => {
      const all = (await owner.get('/api/owner/activity-logs?limit=3').expect(200)).body
      expect(all.meta).toMatchObject({ page: 1, limit: 3 })
      expect(all.meta.total).toBeGreaterThan(5)
      expect(all.data[0]).toMatchObject({ actorName: 'Suwandi', action: 'FAQ_CHANGED' })
      const bank = (
        await owner.get('/api/owner/activity-logs?action=BANK_ACCOUNT_UPDATED').expect(200)
      ).body
      expect(bank.data).toHaveLength(1)
      const byActor = (await owner.get(`/api/owner/activity-logs?actorId=${rinaId}`).expect(200))
        .body
      expect(byActor.data).toEqual([])
      const past = (
        await owner.get('/api/owner/activity-logs?from=2020-01-01&to=2020-01-31').expect(200)
      ).body
      expect(past.meta.total).toBe(0)
      await staff.get('/api/owner/activity-logs').expect(403)
    })
  })
})
