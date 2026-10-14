import { createHash, randomBytes } from 'node:crypto'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { AuthUserDto } from '@ssb/shared'
import bcrypt from 'bcryptjs'
import type { JwtPayload } from '../../common/auth/jwt-auth.guard.js'
import { MailService } from '../../common/mail/mail.service.js'
import { getEnv } from '../../config/env.js'
import { PrismaService } from '../../prisma/prisma.service.js'
import type { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './auth.dto.js'

export const BCRYPT_ROUNDS = 10
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000 // 30 menit, sesuai teks di layar Auth
const INVITE_TOKEN_TTL_MS = 72 * 60 * 60 * 1000 // undangan pegawai: 3 hari
export const USER_SELECT = { id: true, name: true, email: true, phone: true, role: true } as const

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthUserDto> {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (exists) {
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        message: 'Email sudah terdaftar. Silakan masuk.',
      })
    }
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        role: 'CUSTOMER', // pendaftaran publik selalu customer; pegawai dibuat owner
      },
      select: USER_SELECT,
    })
  }

  async login(dto: LoginDto): Promise<AuthUserDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } })
    // Pesan sama untuk email tidak ada dan password salah, supaya email terdaftar tidak bisa ditebak
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email atau password salah. Coba lagi.',
      })
    }
    if (!user.isActive) {
      throw new ForbiddenException({
        code: 'ACCOUNT_INACTIVE',
        message: 'Akun kamu dinonaktifkan. Hubungi toko lewat kanal resmi.',
      })
    }
    return this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: USER_SELECT,
    })
  }

  signToken(user: AuthUserDto): Promise<string> {
    const payload: JwtPayload = { sub: user.id, role: user.role }
    return this.jwt.signAsync(payload)
  }

  // Selalu selesai tanpa error, ada atau tidak ada akunnya (docs/api.md)
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (!user?.isActive) return
    // Email gagal (503 MAIL_FAILED, sudah dicatat MailService) tidak dibocorkan: respons harus sama dengan email yang
    // tidak terdaftar, supaya keberadaan akun tidak bisa ditebak.
    await this.sendPasswordLink(user, 'reset').catch((e: unknown) => {
      if (!(e instanceof ServiceUnavailableException)) throw e
    })
  }

  /** Tautan buat/atur ulang password lewat email: lupa password, reset oleh owner, undangan pegawai baru. */
  async sendPasswordLink(
    user: { id: number; name: string; email: string },
    kind: 'reset' | 'invite',
  ) {
    const token = randomBytes(32).toString('hex')
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(
          Date.now() + (kind === 'invite' ? INVITE_TOKEN_TTL_MS : RESET_TOKEN_TTL_MS),
        ),
      },
    })
    const link = `${getEnv().APP_URL}/reset-password?token=${token}`
    await this.mail.send(
      kind === 'invite'
        ? {
            to: user.email,
            subject: 'Undangan akun pegawai Suwandi SecondBranded',
            text: `Halo ${user.name}, kamu ditambahkan sebagai pegawai. Buka tautan ini dalam 3 hari untuk membuat password:\n${link}`,
          }
        : {
            to: user.email,
            subject: 'Atur ulang password Suwandi SecondBranded',
            text: `Halo ${user.name}, buka tautan ini dalam 30 menit untuk membuat password baru:\n${link}\n\nAbaikan email ini kalau kamu tidak meminta reset password.`,
          },
    )
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(dto.token) },
    })
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'RESET_TOKEN_INVALID',
        message: 'Tautan reset sudah tidak berlaku. Minta tautan baru.',
      })
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS)
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      // tandai semua token user ini terpakai, bukan hanya yang ini
      this.prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ])
  }
}
