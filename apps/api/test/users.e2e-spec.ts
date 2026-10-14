import 'reflect-metadata'
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import bcrypt from 'bcryptjs'
import request from 'supertest'
import { AppModule } from '../src/app.module.js'
import { setupApp } from '../src/app.setup.js'
import { PrismaService } from '../src/prisma/prisma.service.js'

const PASSWORD = 'rahasia-123'
type Agent = ReturnType<typeof request.agent>
const home = {
  label: 'Rumah',
  line: 'Jl. Sei Batang Hari No. 12',
  city: 'Medan',
  postalCode: '20122',
}
const kos = {
  label: 'Kos',
  line: 'Jl. Dr. Mansyur No. 7, Padang Bulan',
  city: 'Medan',
  postalCode: '20155',
}

describe('Profil customer (e2e, database schema e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let rina: Agent
  let budi: Agent
  let staff: Agent

  const login = async (email: string, password = PASSWORD) => {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/api/auth/login').send({ email, password }).expect(200)
    return agent
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = setupApp(moduleRef.createNestApplication())
    await app.init()
    prisma = app.get(PrismaService)
    await prisma.$executeRawUnsafe('TRUNCATE "User" RESTART IDENTITY CASCADE')
    const passwordHash = await bcrypt.hash(PASSWORD, 4)
    await prisma.user.createMany({
      data: [
        { name: 'Rina', email: 'rina@e2e.test', phone: '081200000001', passwordHash },
        { name: 'Budi', email: 'budi@e2e.test', passwordHash },
        { name: 'Staf', email: 'staff@e2e.test', role: 'STAFF', passwordHash },
      ],
    })
    rina = await login('rina@e2e.test')
    budi = await login('budi@e2e.test')
    staff = await login('staff@e2e.test')
  })

  afterAll(() => app.close())

  it('lihat dan ubah profil; email tidak bisa diubah lewat sini', async () => {
    expect((await rina.get('/api/me/profile').expect(200)).body.user).toMatchObject({
      name: 'Rina',
      email: 'rina@e2e.test',
    })
    const res = await rina
      .patch('/api/me/profile')
      .send({ name: '  Rina Siregar ', phone: '0812-3456-7890', email: 'lain@e2e.test' })
      .expect(400) // field tak dikenal ditolak (forbidNonWhitelisted)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    const ok = await rina
      .patch('/api/me/profile')
      .send({ name: '  Rina Siregar ', phone: '0812-3456-7890' })
      .expect(200)
    expect(ok.body.user).toMatchObject({
      name: 'Rina Siregar',
      phone: '081234567890',
      email: 'rina@e2e.test',
    })
    await rina.patch('/api/me/profile').send({ name: 'R', phone: '123' }).expect(400)
    await staff.get('/api/me/profile').expect(403)
    await request(app.getHttpServer()).get('/api/me/profile').expect(401)
  })

  it('alamat: pertama jadi utama, jadikan utama, hapus utama memindahkan utama, milik orang lain 404', async () => {
    const first = await rina.post('/api/me/addresses').send(home).expect(201)
    expect(first.body).toMatchObject([{ label: 'Rumah', isPrimary: true }])
    const both = (await rina.post('/api/me/addresses').send(kos).expect(201)).body
    expect(both.map((a: { label: string; isPrimary: boolean }) => [a.label, a.isPrimary])).toEqual([
      ['Rumah', true],
      ['Kos', false],
    ])
    const kosId = both[1].id
    const homeId = both[0].id

    const switched = (
      await rina.patch(`/api/me/addresses/${kosId}`).send({ isPrimary: true }).expect(200)
    ).body
    expect(switched.map((a: { label: string }) => a.label)).toEqual(['Kos', 'Rumah']) // utama dulu
    expect(switched.filter((a: { isPrimary: boolean }) => a.isPrimary)).toHaveLength(1)

    await rina.patch(`/api/me/addresses/${homeId}`).send({ city: 'Binjai' }).expect(200)
    await rina.patch(`/api/me/addresses/${homeId}`).send({ postalCode: '201' }).expect(400)
    await rina.patch(`/api/me/addresses/${homeId}`).send({ isPrimary: false }).expect(400)

    await budi.patch(`/api/me/addresses/${homeId}`).send({ city: 'Bandung' }).expect(404)
    await budi.delete(`/api/me/addresses/${homeId}`).expect(404)
    expect((await budi.get('/api/me/addresses').expect(200)).body).toEqual([])

    const left = (await rina.delete(`/api/me/addresses/${kosId}`).expect(200)).body
    expect(left).toMatchObject([{ id: homeId, city: 'Binjai', isPrimary: true }])
  })

  it('ganti password: password lama wajib benar, lalu login dengan yang baru', async () => {
    const wrong = await budi
      .post('/api/me/change-password')
      .send({ currentPassword: 'salah-sekali', newPassword: 'baru-12345' })
      .expect(400)
    expect(wrong.body.code).toBe('WRONG_PASSWORD')
    await budi
      .post('/api/me/change-password')
      .send({ currentPassword: PASSWORD, newPassword: 'pendek' })
      .expect(400)
    await budi
      .post('/api/me/change-password')
      .send({ currentPassword: PASSWORD, newPassword: 'baru-12345' })
      .expect(204)
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'budi@e2e.test', password: PASSWORD })
      .expect(401)
    await login('budi@e2e.test', 'baru-12345')
  })

  it('pegawai ganti password lewat /panel/me; customer tidak boleh memakai endpoint panel', async () => {
    await rina
      .post('/api/panel/me/change-password')
      .send({ currentPassword: PASSWORD, newPassword: 'baru-12345' })
      .expect(403)
    await staff.post('/api/me/change-password').send({}).expect(403)
    const wrong = await staff
      .post('/api/panel/me/change-password')
      .send({ currentPassword: 'salah-sekali', newPassword: 'staf-baru-123' })
      .expect(400)
    expect(wrong.body.code).toBe('WRONG_PASSWORD')
    await staff
      .post('/api/panel/me/change-password')
      .send({ currentPassword: PASSWORD, newPassword: 'staf-baru-123' })
      .expect(204)
    await login('staff@e2e.test', 'staf-baru-123')
  })
})
