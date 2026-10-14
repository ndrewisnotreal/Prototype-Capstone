import 'reflect-metadata'
import { Controller, Get, INestApplication, ServiceUnavailableException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import bcrypt from 'bcryptjs'
import request from 'supertest'
import { AppModule } from '../src/app.module.js'
import { setupApp } from '../src/app.setup.js'
import { Roles } from '../src/common/auth/auth.decorators.js'
import { MailService } from '../src/common/mail/mail.service.js'
import { PrismaService } from '../src/prisma/prisma.service.js'

// Endpoint khusus test untuk memeriksa RolesGuard
@Controller('test-roles')
class RolesTestController {
  @Roles('OWNER')
  @Get('owner')
  owner() {
    return { ok: true }
  }

  @Roles('STAFF', 'OWNER')
  @Get('panel')
  panel() {
    return { ok: true }
  }

  @Get('lupa-dekorator')
  forgotten() {
    return { ok: true }
  }
}

const PASSWORD = 'rahasia-123'

describe('Auth (e2e, database schema e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let mail: MailService
  const server = () => app.getHttpServer()

  const createUser = async (email: string, role: 'CUSTOMER' | 'STAFF' | 'OWNER', isActive = true) =>
    prisma.user.create({
      data: { name: role, email, role, isActive, passwordHash: await bcrypt.hash(PASSWORD, 4) },
    })
  const loginAs = async (email: string, password = PASSWORD) => {
    const agent = request.agent(server())
    const res = await agent.post('/api/auth/login').send({ email, password })
    return { agent, res }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [RolesTestController],
    }).compile()
    app = setupApp(moduleRef.createNestApplication())
    await app.init()
    prisma = app.get(PrismaService)
    mail = app.get(MailService)
    await prisma.$executeRawUnsafe('TRUNCATE "User", "PasswordResetToken" RESTART IDENTITY CASCADE')
    await createUser('owner@e2e.test', 'OWNER')
    await createUser('staff@e2e.test', 'STAFF')
    await createUser('customer@e2e.test', 'CUSTOMER')
  })

  afterAll(() => app.close())

  describe('register', () => {
    const body = {
      name: 'Rina',
      email: '  Rina@E2E.test ',
      phone: '081234567890',
      password: PASSWORD,
    }

    it('membuat CUSTOMER, menyimpan email huruf kecil, dan memasang cookie httpOnly', async () => {
      const res = await request(server()).post('/api/auth/register').send(body).expect(201)
      expect(res.body.user).toEqual({
        id: expect.any(Number),
        name: 'Rina',
        email: 'rina@e2e.test',
        phone: '081234567890',
        role: 'CUSTOMER',
      })
      expect(res.headers['set-cookie'][0]).toMatch(/^ssb_token=.+HttpOnly; SameSite=Lax/)
    })

    it('menolak email yang sudah terdaftar', async () => {
      const res = await request(server()).post('/api/auth/register').send(body).expect(409)
      expect(res.body.code).toBe('EMAIL_TAKEN')
    })

    it('tidak bisa mendaftar sebagai OWNER lewat body', async () => {
      const res = await request(server())
        .post('/api/auth/register')
        .send({ ...body, email: 'x@e2e.test', role: 'OWNER' })
        .expect(400)
      expect(res.body.details.errors).toContain('property role should not exist')
    })

    it('validasi pesan Indonesia', async () => {
      const res = await request(server())
        .post('/api/auth/register')
        .send({ name: 'A', email: 'bukan', phone: '123', password: 'pendek' })
        .expect(400)
      expect(res.body.details.errors).toEqual(
        expect.arrayContaining([
          'Nama minimal 2 karakter',
          'Format email belum benar',
          'Nomor HP belum benar, contoh 081234567890',
          'Password minimal 8 karakter',
        ]),
      )
    })
  })

  describe('login per role', () => {
    it.each([
      ['owner@e2e.test', 'OWNER', 200, 200],
      ['staff@e2e.test', 'STAFF', 403, 200],
      ['customer@e2e.test', 'CUSTOMER', 403, 403],
    ] as const)('%s → me.role %s, /owner %i, /panel %i', async (email, role, owner, panel) => {
      const { agent, res } = await loginAs(email)
      expect(res.status).toBe(200)
      expect(res.body.user.role).toBe(role)
      expect((await agent.get('/api/auth/me').expect(200)).body.user.email).toBe(email)
      await agent.get('/api/test-roles/owner').expect(owner)
      await agent.get('/api/test-roles/panel').expect(panel)
    })

    it('email tidak ada dan password salah memberi pesan yang sama', async () => {
      const wrongPassword = (await loginAs('owner@e2e.test', 'salah-sekali')).res
      const unknownEmail = (await loginAs('tidak-ada@e2e.test')).res
      expect(wrongPassword.status).toBe(401)
      expect(unknownEmail.body).toEqual(wrongPassword.body)
      expect(wrongPassword.body).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Email atau password salah. Coba lagi.',
      })
    })

    it('tanpa cookie atau dengan token palsu → 401', async () => {
      await request(server()).get('/api/auth/me').expect(401)
      const res = await request(server())
        .get('/api/test-roles/panel')
        .set('Cookie', 'ssb_token=palsu')
        .expect(401)
      expect(res.body.code).toBe('UNAUTHENTICATED')
    })
  })

  describe('akun nonaktif', () => {
    it('tidak bisa login', async () => {
      await createUser('nonaktif@e2e.test', 'STAFF', false)
      const { res } = await loginAs('nonaktif@e2e.test')
      expect(res.status).toBe(403)
      expect(res.body.code).toBe('ACCOUNT_INACTIVE')
    })

    it('sesi yang sudah ada langsung ditolak setelah dinonaktifkan', async () => {
      const user = await createUser('dinonaktifkan@e2e.test', 'STAFF')
      const { agent } = await loginAs(user.email)
      await agent.get('/api/test-roles/panel').expect(200)
      await prisma.user.update({ where: { id: user.id }, data: { isActive: false } })
      await agent.get('/api/test-roles/panel').expect(401)
    })
  })

  it('logout menghapus cookie', async () => {
    const { agent } = await loginAs('customer@e2e.test')
    const res = await agent.post('/api/auth/logout').expect(204)
    expect(res.headers['set-cookie'][0]).toMatch(/^ssb_token=;.*Expires=Thu, 01 Jan 1970/)
    await agent.get('/api/auth/me').expect(401)
  })

  it('endpoint tanpa @Roles dan tanpa @Public ditolak (fail-closed)', async () => {
    const { agent } = await loginAs('owner@e2e.test')
    const res = await agent.get('/api/test-roles/lupa-dekorator').expect(500)
    expect(res.body.code).toBe('MISSING_ROLES')
  })

  describe('lupa dan reset password', () => {
    it('email tidak terdaftar tetap 200 tanpa mengirim email', async () => {
      const send = vi.spyOn(mail, 'send')
      await request(server())
        .post('/api/auth/forgot-password')
        .send({ email: 'tidak-ada@e2e.test' })
        .expect(200)
      expect(send).not.toHaveBeenCalled()
      send.mockRestore()
    })

    it('email gagal terkirim: respons tetap sama seperti email tidak terdaftar', async () => {
      const send = vi
        .spyOn(mail, 'send')
        .mockRejectedValue(new ServiceUnavailableException({ code: 'MAIL_FAILED' }))
      const res = await request(server())
        .post('/api/auth/forgot-password')
        .send({ email: 'customer@e2e.test' })
        .expect(200)
      expect(res.body.message).toContain('Kalau email itu terdaftar')
      expect(send).toHaveBeenCalledOnce()
      send.mockRestore()
    })

    it('tautan dari email mengganti password satu kali saja', async () => {
      const send = vi.spyOn(mail, 'send')
      await request(server())
        .post('/api/auth/forgot-password')
        .send({ email: 'customer@e2e.test' })
        .expect(200)
      const token = /token=([a-f0-9]+)/.exec(send.mock.calls[0][0].text)![1]
      send.mockRestore()

      const newPassword = 'password-baru-1'
      await request(server())
        .post('/api/auth/reset-password')
        .send({ token, password: newPassword })
        .expect(200)
      expect((await loginAs('customer@e2e.test', newPassword)).res.status).toBe(200)
      expect((await loginAs('customer@e2e.test')).res.status).toBe(401)

      const reuse = await request(server())
        .post('/api/auth/reset-password')
        .send({ token, password: 'password-lain-1' })
        .expect(400)
      expect(reuse.body.code).toBe('RESET_TOKEN_INVALID')
    })
  })
})
