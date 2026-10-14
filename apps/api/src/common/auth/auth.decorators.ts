import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common'
import type { AuthUserDto, Role } from '@ssb/shared'
import type { Request } from 'express'

export const AUTH_COOKIE = 'ssb_token'
export const IS_PUBLIC_KEY = 'isPublic'
export const ROLES_KEY = 'roles'

/** Endpoint boleh diakses tanpa login. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

/** Endpoint hanya untuk role ini. Setiap endpoint non-publik WAJIB punya @Roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)

export type AuthRequest = Request & { user?: AuthUserDto }

/** User yang sedang login (diisi JwtAuthGuard). */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthRequest>().user,
)
