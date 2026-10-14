import 'reflect-metadata'
import { Body, Controller, INestApplication, Post } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { IsEmail } from 'class-validator'
import request from 'supertest'
import { AppModule } from '../src/app.module.js'
import { Public } from '../src/common/auth/auth.decorators.js'
import { setupApp } from '../src/app.setup.js'
import { PrismaService } from '../src/prisma/prisma.service.js'

class EchoDto {
  @IsEmail({}, { message: 'Format email belum benar' })
  email!: string
}

// Hanya untuk test: memastikan ValidationPipe + filter menghasilkan format error yang benar
@Public()
@Controller('test-echo')
class EchoController {
  @Post()
  echo(@Body() dto: EchoDto) {
    return dto
  }
}

describe('API (e2e)', () => {
  let app: INestApplication
  const prisma = { $queryRaw: vi.fn() }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [EchoController],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile()
    app = setupApp(moduleRef.createNestApplication())
    await app.init()
  })

  afterAll(() => app.close())

  it('GET /api/health → 200 saat database terhubung', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }])
    const res = await request(app.getHttpServer()).get('/api/health').expect(200)
    expect(res.body).toEqual({ status: 'ok', database: 'up' })
  })

  it('GET /api/health → 503 dengan format error seragam saat database mati', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const res = await request(app.getHttpServer()).get('/api/health').expect(503)
    expect(res.body).toEqual({
      statusCode: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database tidak dapat dihubungi',
    })
  })

  it('route tidak dikenal → 404 NOT_FOUND', async () => {
    const res = await request(app.getHttpServer()).get('/api/tidak-ada').expect(404)
    expect(res.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' })
  })

  it('ValidationPipe → 400 VALIDATION_ERROR dengan pesan per field', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/test-echo')
      .send({ email: 'bukan-email', extra: 1 })
      .expect(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(res.body.details.errors).toEqual(
      expect.arrayContaining(['Format email belum benar', 'property extra should not exist']),
    )
  })
})
