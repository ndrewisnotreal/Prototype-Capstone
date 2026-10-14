import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Role } from '@ssb/shared'
import { IS_PUBLIC_KEY, ROLES_KEY, type AuthRequest } from './auth.decorators.js'

// Guard global setelah JwtAuthGuard. Endpoint tanpa @Public dan tanpa @Roles ditolak (fail-closed),
// supaya lupa memberi dekorator langsung ketahuan saat dicoba, bukan diam-diam terbuka.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()]
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets)
    if (!roles?.length) {
      throw new InternalServerErrorException({
        code: 'MISSING_ROLES',
        message: `Endpoint ${ctx.getClass().name}.${ctx.getHandler().name} belum diberi @Roles atau @Public`,
      })
    }

    const user = ctx.switchToHttp().getRequest<AuthRequest>().user
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Kamu tidak punya akses ke halaman ini.',
      })
    }
    return true
  }
}
