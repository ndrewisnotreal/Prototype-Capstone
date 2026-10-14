import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import type { FaqDto, OpeningHourDto, OwnerBankAccountDto, StoreSettingsDto } from '@ssb/shared'
import bcrypt from 'bcryptjs'
import { PrismaService } from '../../prisma/prisma.service.js'
import { ActivityAction, ActivityLogService } from '../activity-log/activity-log.service.js'
import type {
  BankAccountInputDto,
  FaqInputDto,
  UpdateStoreSettingsDto,
} from './store-settings.dto.js'

const BANK_SELECT = {
  id: true,
  bankName: true,
  accountNumber: true,
  accountName: true,
  isActive: true,
  sortOrder: true,
} as const
const FAQ_SELECT = {
  id: true,
  question: true,
  answer: true,
  sortOrder: true,
  isActive: true,
} as const
const ORDER_BY = [{ sortOrder: 'asc' as const }, { id: 'asc' as const }]

const json = (value: unknown) => value as Prisma.InputJsonValue
/** Field rekening saja; password konfirmasi tidak ikut disimpan atau dicatat */
const bankData = (d: BankAccountInputDto) => ({
  bankName: d.bankName,
  accountNumber: d.accountNumber,
  accountName: d.accountName,
  isActive: d.isActive,
  sortOrder: d.sortOrder,
})

const notFound = (what: string) =>
  new NotFoundException({ code: 'NOT_FOUND', message: `${what} tidak ditemukan.` })

/** Pengaturan toko, rekening resmi, dan FAQ untuk owner (layar O-Pengaturan). Setiap perubahan tercatat di log. */
@Injectable()
export class StoreSettingsOwnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  // ---------- pengaturan ----------

  async settings(): Promise<StoreSettingsDto> {
    const s = await this.prisma.storeSetting.findUnique({ where: { id: 1 } })
    if (!s) throw notFound('Pengaturan toko')
    return this.toSettings(s)
  }

  async updateSettings(ownerId: number, dto: UpdateStoreSettingsDto): Promise<StoreSettingsDto> {
    const before = await this.prisma.storeSetting.findUnique({ where: { id: 1 } })
    const data = { ...dto, openingHours: dto.openingHours as unknown as Prisma.InputJsonValue }
    const saved = await this.prisma.$transaction(async (tx) => {
      const s = await tx.storeSetting.upsert({ where: { id: 1 }, create: data, update: data })
      await this.activity.record(tx, {
        actorId: ownerId,
        action: ActivityAction.SETTINGS_UPDATED,
        entityType: 'StoreSetting',
        entityId: 1,
        before: before ? json(this.toSettings(before)) : undefined,
        after: json(this.toSettings(s)),
      })
      return s
    })
    return this.toSettings(saved)
  }

  private toSettings(s: Prisma.StoreSettingGetPayload<object>): StoreSettingsDto {
    return {
      whatsapp: s.whatsapp,
      instagram: s.instagram,
      tiktok: s.tiktok,
      address: s.address,
      openingHours: s.openingHours as unknown as OpeningHourDto[],
      paymentDeadlineHours: s.paymentDeadlineHours,
      fulfillmentMethods: s.fulfillmentMethods,
      updatedAt: s.updatedAt.toISOString(),
    }
  }

  // ---------- rekening (konfirmasi password owner) ----------

  bankAccounts(): Promise<OwnerBankAccountDto[]> {
    return this.prisma.bankAccount.findMany({ orderBy: ORDER_BY, select: BANK_SELECT })
  }

  async createBankAccount(ownerId: number, dto: BankAccountInputDto) {
    await this.confirmPassword(ownerId, dto.password)
    const data = bankData(dto)
    await this.prisma.$transaction(async (tx) => {
      const account = await tx.bankAccount.create({ data, select: BANK_SELECT })
      await this.activity.record(tx, {
        actorId: ownerId,
        action: ActivityAction.BANK_ACCOUNT_CREATED,
        entityType: 'BankAccount',
        entityId: account.id,
        after: account,
      })
    })
    return this.bankAccounts()
  }

  async updateBankAccount(ownerId: number, id: number, dto: BankAccountInputDto) {
    await this.confirmPassword(ownerId, dto.password)
    const before = await this.prisma.bankAccount.findUnique({ where: { id }, select: BANK_SELECT })
    if (!before) throw notFound('Rekening')
    const data = bankData(dto)
    await this.prisma.$transaction(async (tx) => {
      const after = await tx.bankAccount.update({ where: { id }, data, select: BANK_SELECT })
      await this.activity.record(tx, {
        actorId: ownerId,
        action: ActivityAction.BANK_ACCOUNT_UPDATED,
        entityType: 'BankAccount',
        entityId: id,
        before,
        after,
      })
    })
    return this.bankAccounts()
  }

  async deleteBankAccount(ownerId: number, id: number, password: string) {
    await this.confirmPassword(ownerId, password)
    const before = await this.prisma.bankAccount.findUnique({ where: { id }, select: BANK_SELECT })
    if (!before) throw notFound('Rekening')
    await this.prisma.$transaction(async (tx) => {
      await tx.bankAccount.delete({ where: { id } })
      await this.activity.record(tx, {
        actorId: ownerId,
        action: ActivityAction.BANK_ACCOUNT_DELETED,
        entityType: 'BankAccount',
        entityId: id,
        before,
      })
    })
    return this.bankAccounts()
  }

  /** Rekening tidak bisa diganti diam-diam walau sesi owner terbuka di perangkat lain */
  private async confirmPassword(ownerId: number, password: string) {
    const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: ownerId } })
    if (!(await bcrypt.compare(password, owner.passwordHash))) {
      throw new BadRequestException({
        code: 'WRONG_PASSWORD',
        message: 'Password owner salah. Rekening tidak diubah.',
      })
    }
  }

  // ---------- FAQ ----------

  faqs(): Promise<FaqDto[]> {
    return this.prisma.faq.findMany({ orderBy: ORDER_BY, select: FAQ_SELECT })
  }

  async createFaq(ownerId: number, dto: FaqInputDto) {
    await this.prisma.$transaction(async (tx) => {
      const faq = await tx.faq.create({ data: dto, select: FAQ_SELECT })
      await this.logFaq(tx, ownerId, faq.id, undefined, faq)
    })
    return this.faqs()
  }

  async updateFaq(ownerId: number, id: number, dto: FaqInputDto) {
    const before = await this.prisma.faq.findUnique({ where: { id }, select: FAQ_SELECT })
    if (!before) throw notFound('FAQ')
    await this.prisma.$transaction(async (tx) => {
      const after = await tx.faq.update({ where: { id }, data: dto, select: FAQ_SELECT })
      await this.logFaq(tx, ownerId, id, before, after)
    })
    return this.faqs()
  }

  async deleteFaq(ownerId: number, id: number) {
    const before = await this.prisma.faq.findUnique({ where: { id }, select: FAQ_SELECT })
    if (!before) throw notFound('FAQ')
    await this.prisma.$transaction(async (tx) => {
      await tx.faq.delete({ where: { id } })
      await this.logFaq(tx, ownerId, id, before, undefined)
    })
    return this.faqs()
  }

  private logFaq(
    tx: Prisma.TransactionClient,
    ownerId: number,
    id: number,
    before: FaqDto | undefined,
    after: FaqDto | undefined,
  ) {
    return this.activity.record(tx, {
      actorId: ownerId,
      action: ActivityAction.FAQ_CHANGED,
      entityType: 'Faq',
      entityId: id,
      before: before && json(before),
      after: after && json(after),
    })
  }
}
