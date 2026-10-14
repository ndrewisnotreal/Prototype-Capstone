import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { Public } from '../common/auth/auth.decorators.js'
import { PrismaService } from '../prisma/prisma.service.js'

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      throw new ServiceUnavailableException({
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database tidak dapat dihubungi',
      })
    }
    return { status: 'ok', database: 'up' }
  }
}
