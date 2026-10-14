import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common'
import type { AuthUserDto } from '@ssb/shared'
import type { CookieOptions, Response } from 'express'
import { AUTH_COOKIE, CurrentUser, Public, Roles } from '../../common/auth/auth.decorators.js'
import { getEnv } from '../../config/env.js'
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './auth.dto.js'
import { AuthService } from './auth.service.js'

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: getEnv().NODE_ENV === 'production',
  path: '/',
})
const SESSION_MS = 7 * 24 * 60 * 60 * 1000 // sama dengan expiresIn JWT di AuthModule

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.register(dto)
    await this.setSession(res, user)
    return { user }
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.login(dto)
    await this.setSession(res, user)
    return { user }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, cookieOptions())
  }

  @Roles('CUSTOMER', 'STAFF', 'OWNER')
  @Get('me')
  me(@CurrentUser() user: AuthUserDto) {
    return { user }
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto)
    return { message: 'Kalau email itu terdaftar, tautan reset password sudah kami kirim.' }
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto)
    return { message: 'Password berhasil diubah. Silakan masuk dengan password baru.' }
  }

  private async setSession(res: Response, user: AuthUserDto) {
    res.cookie(AUTH_COOKIE, await this.auth.signToken(user), {
      ...cookieOptions(),
      maxAge: SESSION_MS,
    })
  }
}
