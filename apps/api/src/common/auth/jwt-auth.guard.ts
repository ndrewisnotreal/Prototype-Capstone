import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../../prisma/prisma.service.js'
import { AUTH_COOKIE, IS_PUBLIC_KEY, type AuthRequest } from './auth.decorators.js'

export interface JwtPayload {
  sub: number
  role: string
}

// Guard global: membaca JWT dari cookie, lalu memuat user dari database di setiap request,
// supaya akun yang dinonaktifkan atau role yang diubah owner langsung berlaku (ADR-0003).
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (isPublic) return true

    const req = ctx.switchToHttp().getRequest<AuthRequest>()
    const token: unknown = req.cookies?.[AUTH_COOKIE]
    const payload =
      typeof token === 'string'
        ? await this.jwt.verifyAsync<JwtPayload>(token).catch(() => null)
        : null
    const user = payload
      ? await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, name: true, email: true, phone: true, role: true, isActive: true },
        })
      : null
    if (!user?.isActive) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Sesi kamu sudah berakhir. Silakan masuk lagi.',
      })
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    }
    return true
  }
}
