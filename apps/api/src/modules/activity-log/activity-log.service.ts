import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import type { ActivityLogDto, Paginated } from '@ssb/shared'
import { PrismaService } from '../../prisma/prisma.service.js'

/** Nama aksi di ActivityLog.action. Tambah di sini, jangan menulis string baru di tempat lain. */
export const ActivityAction = {
  PRODUCT_CREATED: 'PRODUCT_CREATED',
  PRODUCT_UPDATED: 'PRODUCT_UPDATED',
  PRICE_CHANGED: 'PRICE_CHANGED',
  PRODUCT_STATUS_CHANGED: 'PRODUCT_STATUS_CHANGED',
  PRODUCT_PHOTOS_CHANGED: 'PRODUCT_PHOTOS_CHANGED',
  PAYMENT_ACCEPTED: 'PAYMENT_ACCEPTED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  STAFF_CREATED: 'STAFF_CREATED',
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',
  PASSWORD_RESET_SENT: 'PASSWORD_RESET_SENT',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  BANK_ACCOUNT_CREATED: 'BANK_ACCOUNT_CREATED',
  BANK_ACCOUNT_UPDATED: 'BANK_ACCOUNT_UPDATED',
  BANK_ACCOUNT_DELETED: 'BANK_ACCOUNT_DELETED',
  FAQ_CHANGED: 'FAQ_CHANGED',
} as const
export type ActivityAction = (typeof ActivityAction)[keyof typeof ActivityAction]

export interface ActivityEntry {
  actorId: number | null
  action: ActivityAction
  entityType: 'Product' | 'Order' | 'StoreSetting' | 'User' | 'BankAccount' | 'Faq'
  entityId: string | number
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
}

export interface ActivityLogQuery {
  actorId?: number
  action?: string
  /** instant UTC, inklusif */
  from?: Date
  /** instant UTC, eksklusif */
  to?: Date
  page?: number
  limit?: number
}

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Selalu dipanggil dengan client transaksi, supaya log dan perubahannya tersimpan bersama atau tidak sama sekali. */
  record(tx: Prisma.TransactionClient, entry: ActivityEntry) {
    return tx.activityLog.create({ data: { ...entry, entityId: String(entry.entityId) } })
  }

  /** Log terbaru dulu, dengan nama pelaku (layar O-Log dan "Aktivitas terbaru" dashboard owner) */
  async list(q: ActivityLogQuery = {}): Promise<Paginated<ActivityLogDto>> {
    const page = q.page ?? 1
    const limit = q.limit ?? 30
    const where: Prisma.ActivityLogWhereInput = {
      ...(q.actorId && { actorId: q.actorId }),
      ...(q.action && { action: q.action }),
      ...((q.from || q.to) && { createdAt: { gte: q.from, lt: q.to } }),
    }
    const [logs, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ])
    const actorIds = [
      ...new Set(logs.map((l) => l.actorId).filter((id): id is number => id !== null)),
    ]
    const actors = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true },
    })
    const name = new Map(actors.map((a) => [a.id, a.name]))
    return {
      data: logs.map((l) => ({
        id: l.id,
        actorName: l.actorId ? (name.get(l.actorId) ?? null) : null,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        before: l.before,
        after: l.after,
        createdAt: l.createdAt.toISOString(),
      })),
      meta: { page, limit, total },
    }
  }
}
