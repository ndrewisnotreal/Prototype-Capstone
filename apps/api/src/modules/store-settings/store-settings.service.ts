import { Injectable, NotFoundException } from '@nestjs/common'
import type { OfficialChannelsDto, OpeningHourDto } from '@ssb/shared'
import { PrismaService } from '../../prisma/prisma.service.js'

@Injectable()
export class StoreSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Kanal resmi untuk publik. Rekening nonaktif tidak pernah ikut (business-rules: Kanal resmi). */
  async officialChannels(): Promise<OfficialChannelsDto> {
    const [setting, bankAccounts] = await Promise.all([
      this.prisma.storeSetting.findUnique({ where: { id: 1 } }),
      this.prisma.bankAccount.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: { id: true, bankName: true, accountNumber: true, accountName: true },
      }),
    ])
    if (!setting) {
      throw new NotFoundException({
        code: 'STORE_SETTINGS_MISSING',
        message: 'Info toko belum diisi owner.',
      })
    }
    return {
      whatsapp: setting.whatsapp,
      instagram: setting.instagram,
      tiktok: setting.tiktok,
      address: setting.address,
      openingHours: setting.openingHours as unknown as OpeningHourDto[],
      paymentDeadlineHours: setting.paymentDeadlineHours,
      fulfillmentMethods: setting.fulfillmentMethods,
      bankAccounts,
      updatedAt: setting.updatedAt.toISOString(),
    }
  }
}
