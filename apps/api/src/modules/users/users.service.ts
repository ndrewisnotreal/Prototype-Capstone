import { randomBytes } from 'node:crypto'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import type { AddressDto as AddressView, AuthUserDto, OwnerUserDto, Paginated } from '@ssb/shared'
import bcrypt from 'bcryptjs'
import { PrismaService } from '../../prisma/prisma.service.js'
import { ActivityAction, ActivityLogService } from '../activity-log/activity-log.service.js'
import { AuthService, BCRYPT_ROUNDS, USER_SELECT } from '../auth/auth.service.js'
import type {
  AddressDto,
  ChangePasswordDto,
  CreateStaffDto,
  OwnerUserListQueryDto,
  UpdateAddressDto,
  UpdateProfileDto,
} from './users.dto.js'

const ADDRESS_SELECT = {
  id: true,
  label: true,
  line: true,
  city: true,
  postalCode: true,
  isPrimary: true,
} as const
const MAX_ADDRESSES = 10

const addressNotFound = () =>
  new NotFoundException({ code: 'ADDRESS_NOT_FOUND', message: 'Alamat tidak ditemukan.' })

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly activity: ActivityLogService,
  ) {}

  updateProfile(userId: number, dto: UpdateProfileDto): Promise<AuthUserDto> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, phone: dto.phone },
      select: USER_SELECT,
    })
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException({
        code: 'WRONG_PASSWORD',
        message: 'Password sekarang salah.',
      })
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) },
    })
  }

  // ---------- owner: akun pegawai dan customer ----------

  async listForOwner(q: OwnerUserListQueryDto): Promise<Paginated<OwnerUserDto>> {
    const page = q.page ?? 1
    const limit = q.limit ?? 20
    const term = q.q?.trim()
    // daftar pegawai juga memuat owner (ditampilkan tanpa tombol aksi)
    const where: Prisma.UserWhereInput = {
      role: q.role === 'STAFF' ? { in: ['STAFF', 'OWNER'] } : 'CUSTOMER',
      ...(term && {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term.replace(/[\s-]/g, '') } },
        ],
      }),
    }
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { orders: true } } },
      }),
      this.prisma.user.count({ where }),
    ])
    return {
      data: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
        orderCount: u._count.orders,
      })),
      meta: { page, limit, total },
    }
  }

  /** Pegawai baru tanpa password yang bisa dipakai; email undangan berisi tautan membuat password sendiri. */
  async createStaff(ownerId: number, dto: CreateStaffDto): Promise<AuthUserDto> {
    if (await this.prisma.user.findUnique({ where: { email: dto.email } })) {
      throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'Email sudah terdaftar.' })
    }
    const staff = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          ...dto,
          role: 'STAFF',
          // hash acak: tidak bisa login dengan password sampai pegawai membuat password lewat undangan
          passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_ROUNDS),
        },
        select: USER_SELECT,
      })
      await this.activity.record(tx, {
        actorId: ownerId,
        action: ActivityAction.STAFF_CREATED,
        entityType: 'User',
        entityId: user.id,
        after: { name: user.name, email: user.email },
      })
      return user
    })
    await this.auth.sendPasswordLink(staff, 'invite').catch((e: unknown) => {
      if (!(e instanceof ServiceUnavailableException)) throw e
      // akun sudah tersimpan; owner mengirim ulang lewat "Reset password" di daftar pegawai
      throw new ServiceUnavailableException({
        code: 'INVITE_MAIL_FAILED',
        message:
          'Akun pegawai sudah dibuat, tetapi email undangan belum terkirim. Kirim ulang lewat tombol Reset password di daftar pegawai.',
      })
    })
    return staff
  }

  /** Aktif/nonaktif pegawai atau customer. Akun owner tidak bisa diubah dari sini. */
  async setActive(ownerId: number, userId: number, isActive: boolean) {
    const user = await this.managedUser(userId)
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { isActive } })
      await this.activity.record(tx, {
        actorId: ownerId,
        action: ActivityAction.USER_STATUS_CHANGED,
        entityType: 'User',
        entityId: userId,
        before: { isActive: user.isActive },
        after: { isActive },
      })
    })
    return { ...user, isActive }
  }

  async sendResetLink(ownerId: number, userId: number) {
    const user = await this.managedUser(userId)
    if (!user.isActive) {
      throw new ConflictException({
        code: 'ACCOUNT_INACTIVE',
        message: 'Aktifkan akun ini dulu sebelum mengirim tautan reset.',
      })
    }
    await this.auth.sendPasswordLink(user, 'reset')
    await this.prisma.$transaction((tx) =>
      this.activity.record(tx, {
        actorId: ownerId,
        action: ActivityAction.PASSWORD_RESET_SENT,
        entityType: 'User',
        entityId: userId,
      }),
    )
  }

  private async managedUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ...USER_SELECT, isActive: true },
    })
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Akun tidak ditemukan.' })
    }
    if (user.role === 'OWNER') {
      throw new ForbiddenException({
        code: 'OWNER_PROTECTED',
        message: 'Akun owner tidak bisa diubah dari halaman ini.',
      })
    }
    return user
  }

  // ---------- alamat ----------

  listAddresses(userId: number): Promise<AddressView[]> {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }],
      select: ADDRESS_SELECT,
    })
  }

  async createAddress(userId: number, dto: AddressDto): Promise<AddressView[]> {
    const count = await this.prisma.address.count({ where: { userId } })
    if (count >= MAX_ADDRESSES) {
      throw new BadRequestException({
        code: 'ADDRESS_LIMIT',
        message: `Maksimal ${MAX_ADDRESSES} alamat. Hapus yang tidak dipakai dulu.`,
      })
    }
    // alamat pertama otomatis jadi utama
    await this.prisma.address.create({ data: { ...dto, userId, isPrimary: count === 0 } })
    return this.listAddresses(userId)
  }

  async updateAddress(userId: number, id: number, dto: UpdateAddressDto): Promise<AddressView[]> {
    await this.ownAddress(userId, id)
    const { isPrimary, ...fields } = dto
    await this.prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.address.updateMany({ where: { userId, NOT: { id } }, data: { isPrimary: false } })
      }
      await tx.address.update({
        where: { id },
        data: { ...fields, ...(isPrimary && { isPrimary }) },
      })
    })
    return this.listAddresses(userId)
  }

  async deleteAddress(userId: number, id: number): Promise<AddressView[]> {
    const address = await this.ownAddress(userId, id)
    await this.prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id } })
      if (address.isPrimary) {
        // alamat utama dihapus: alamat tertua berikutnya jadi utama
        const next = await tx.address.findFirst({ where: { userId }, orderBy: { id: 'asc' } })
        if (next) await tx.address.update({ where: { id: next.id }, data: { isPrimary: true } })
      }
    })
    return this.listAddresses(userId)
  }

  private async ownAddress(userId: number, id: number) {
    const address = await this.prisma.address.findFirst({ where: { id, userId } })
    if (!address) throw addressNotFound()
    return address
  }
}
