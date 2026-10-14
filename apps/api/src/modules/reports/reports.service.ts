import { BadRequestException, Injectable } from '@nestjs/common'
import type { Fulfillment, OrderStatus, Prisma } from '@prisma/client'
import type {
  OwnerDashboardDto,
  PerformancePeriod,
  ProductPerformanceDto,
  ReportGranularity,
  SalesReportDto,
  SalesReportRowDto,
} from '@ssb/shared'
import {
  DAY_MS,
  isoWeek,
  parseWibDate,
  toWibDate,
  wibParts,
  wibStart,
} from '../../common/utils/wib.js'
import { PrismaService } from '../../prisma/prisma.service.js'
import { ActivityLogService } from '../activity-log/activity-log.service.js'

/** Sepatu Tersedia lebih lama dari ini dianggap "belum laku" (layar O-Performa) */
export const SLOW_MOVING_DAYS = 30
const SLOW_MOVING_LIMIT = 10
const MAX_REPORT_DAYS = 366
const TOP_BRANDS = 5
const RECENT_ACTIVITY = 5
const ACTIVE_STATUSES: OrderStatus[] = [
  'AWAITING_PAYMENT',
  'AWAITING_VERIFICATION',
  'PROCESSING',
  'READY_FOR_PICKUP',
  'SHIPPED',
]
const MONTH_LABEL = new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'Asia/Jakarta' })

const round1 = (n: number) => Math.round(n * 10) / 10
const daysBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / DAY_MS
const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  // ---------- data dasar ----------

  /** Penjualan dalam [from, to): bukti ACCEPTED pada rentang itu, pesanannya tidak dibatalkan. */
  private sales(from: Date, to: Date, fulfillment?: Fulfillment) {
    return this.prisma.paymentProof.findMany({
      where: {
        status: 'ACCEPTED',
        reviewedAt: { gte: from, lt: to },
        order: { status: { not: 'CANCELLED' }, ...(fulfillment && { fulfillment }) },
      },
      orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }],
      select: {
        reviewedAt: true,
        reviewedById: true,
        order: {
          select: {
            code: true,
            fulfillment: true,
            totalAmount: true,
            customer: { select: { name: true } },
            items: { orderBy: { id: 'asc' }, select: { brandName: true, model: true } },
          },
        },
      },
    })
  }

  private async userNames(ids: (number | null)[]) {
    const unique = [...new Set(ids.filter((id): id is number => id !== null))]
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    })
    return new Map(users.map((u) => [u.id, u.name]))
  }

  // ---------- laporan penjualan ----------

  async salesReport(q: {
    from: string
    to: string
    fulfillment?: Fulfillment
  }): Promise<SalesReportDto> {
    const from = parseWibDate(q.from)
    const to = new Date(parseWibDate(q.to).getTime() + DAY_MS) // "to" inklusif
    const days = daysBetween(from, to)
    if (days <= 0 || days > MAX_REPORT_DAYS) {
      throw new BadRequestException({
        code: 'INVALID_RANGE',
        message: `Rentang tanggal 1 sampai ${MAX_REPORT_DAYS} hari, dan "sampai" tidak sebelum "dari".`,
      })
    }
    const sales = await this.sales(from, to, q.fulfillment)
    const names = await this.userNames(sales.map((s) => s.reviewedById))
    const rows: SalesReportRowDto[] = sales.map((s) => ({
      verifiedAt: s.reviewedAt!.toISOString(),
      code: s.order.code,
      customerName: s.order.customer.name,
      itemNames: s.order.items.map((i) => `${i.brandName} ${i.model}`),
      fulfillment: s.order.fulfillment,
      verifiedBy: s.reviewedById ? (names.get(s.reviewedById) ?? null) : null,
      total: s.order.totalAmount,
    }))
    const revenue = rows.reduce((sum, r) => sum + r.total, 0)
    const itemsSold = rows.reduce((sum, r) => sum + r.itemNames.length, 0)
    return {
      from: q.from,
      to: q.to,
      fulfillment: q.fulfillment ?? null,
      summary: {
        revenue,
        transactions: rows.length,
        itemsSold,
        averagePerItem: itemsSold ? Math.round(revenue / itemsSold) : 0,
      },
      rows,
    }
  }

  // ---------- dashboard ----------

  async dashboard(granularity: ReportGranularity, now = new Date()): Promise<OwnerDashboardDto> {
    const { year, month } = wibParts(now)
    const monthStart = wibStart(year, month, 1)
    const previousFrom = wibStart(year, month - 1, 1)
    // periode yang sama bulan lalu, dipotong di akhir bulan lalu
    const previousTo = new Date(
      Math.min(
        previousFrom.getTime() + (now.getTime() - monthStart.getTime()),
        monthStart.getTime(),
      ),
    )
    const soldIn = (from: Date, to: Date): Prisma.ProductWhereInput => ({
      status: 'SOLD',
      soldAt: { gte: from, lt: to },
    })

    const [
      current,
      previous,
      sold,
      previousSold,
      available,
      newProducts,
      activeOrders,
      awaitingVerification,
    ] = await Promise.all([
      this.sales(monthStart, now),
      this.sales(previousFrom, previousTo),
      this.prisma.product.count({ where: soldIn(monthStart, now) }),
      this.prisma.product.count({ where: soldIn(previousFrom, previousTo) }),
      this.prisma.product.count({ where: { status: 'AVAILABLE' } }),
      this.prisma.product.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.order.count({ where: { status: { in: ACTIVE_STATUSES } } }),
      this.prisma.order.count({ where: { status: 'AWAITING_VERIFICATION' } }),
    ])
    const sum = (rows: { order: { totalAmount: number } }[]) =>
      rows.reduce((total, r) => total + r.order.totalAmount, 0)

    const [chart, statusGroups, brandGroups, sizeGroups, recentActivity] = await Promise.all([
      this.revenueChart(granularity, now),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: monthStart } },
        _count: { _all: true },
      }),
      this.prisma.product.groupBy({
        by: ['brandId'],
        where: soldIn(monthStart, now),
        _count: { _all: true },
        orderBy: { _count: { brandId: 'desc' } },
        take: TOP_BRANDS,
      }),
      this.prisma.product.groupBy({
        by: ['sizeEu'],
        where: soldIn(monthStart, now),
        _count: { _all: true },
        orderBy: { sizeEu: 'asc' },
      }),
      this.activity.list({ limit: RECENT_ACTIVITY }).then((r) => r.data),
    ])
    const brands = await this.prisma.brand.findMany({
      where: { id: { in: brandGroups.map((g) => g.brandId) } },
      select: { id: true, name: true },
    })
    const brandName = new Map(brands.map((b) => [b.id, b.name]))
    const statusCount = (...statuses: OrderStatus[]) =>
      statusGroups
        .filter((g) => statuses.includes(g.status))
        .reduce((total, g) => total + g._count._all, 0)

    return {
      period: {
        from: monthStart.toISOString(),
        to: now.toISOString(),
        previousFrom: previousFrom.toISOString(),
        previousTo: previousTo.toISOString(),
      },
      kpis: {
        revenue: sum(current),
        previousRevenue: sum(previous),
        sold,
        previousSold,
        available,
        newProducts,
        activeOrders,
        awaitingVerification,
      },
      chart,
      statusCounts: {
        unpaid: statusCount('AWAITING_PAYMENT', 'AWAITING_VERIFICATION'),
        processing: statusCount('PROCESSING'),
        delivering: statusCount('READY_FOR_PICKUP', 'SHIPPED'),
        completed: statusCount('COMPLETED'),
        cancelled: statusCount('CANCELLED'),
      },
      topBrands: brandGroups.map((g) => ({
        name: brandName.get(g.brandId) ?? '-',
        sold: g._count._all,
      })),
      sizes: sizeGroups.map((g) => ({ sizeEu: Number(g.sizeEu), sold: g._count._all })),
      recentActivity,
    }
  }

  /** Pendapatan per hari (14 terakhir), minggu (8 terakhir, Senin awal), atau bulan (Januari s.d. sekarang) */
  private async revenueChart(granularity: ReportGranularity, now: Date) {
    const { year, month, day, weekday } = wibParts(now)
    const starts: Date[] = []
    if (granularity === 'day') {
      for (let i = 13; i >= 0; i--) starts.push(wibStart(year, month, day - i))
    } else if (granularity === 'week') {
      const monday = day - ((weekday + 6) % 7)
      for (let i = 7; i >= 0; i--) starts.push(wibStart(year, month, monday - i * 7))
    } else {
      for (let m = 0; m <= month; m++) starts.push(wibStart(year, m, 1))
    }
    const sales = await this.sales(starts[0]!, now)
    const points = starts.map((from, i) => {
      const to = starts[i + 1] ?? now
      const revenue = sales
        .filter((s) => s.reviewedAt! >= from && s.reviewedAt! < to)
        .reduce((total, s) => total + s.order.totalAmount, 0)
      const label =
        granularity === 'day'
          ? String(wibParts(from).day)
          : granularity === 'week'
            ? `M${isoWeek(from)}`
            : MONTH_LABEL.format(from)
      return { label, from: from.toISOString(), revenue }
    })
    return { granularity, points }
  }

  // ---------- performa produk ----------

  async performance(period: PerformancePeriod, now = new Date()): Promise<ProductPerformanceDto> {
    const { year, month } = wibParts(now)
    const from =
      period === 'ytd' ? wibStart(year, 0, 1) : wibStart(year, month - (period === '6m' ? 5 : 2), 1)
    const slowBefore = new Date(now.getTime() - SLOW_MOVING_DAYS * DAY_MS)

    const [sold, slowTotal, slow] = await Promise.all([
      this.prisma.product.findMany({
        where: { status: 'SOLD', soldAt: { gte: from, lt: now } },
        select: {
          price: true,
          sizeEu: true,
          createdAt: true,
          soldAt: true,
          brand: { select: { name: true } },
          category: { select: { name: true } },
        },
      }),
      this.prisma.product.count({ where: { status: 'AVAILABLE', createdAt: { lt: slowBefore } } }),
      this.prisma.product.findMany({
        where: { status: 'AVAILABLE', createdAt: { lt: slowBefore } },
        orderBy: { createdAt: 'asc' },
        take: SLOW_MOVING_LIMIT,
        select: {
          id: true,
          code: true,
          photos: { where: { isPrimary: true }, select: { url: true }, take: 1 },
          model: true,
          sizeEu: true,
          price: true,
          createdAt: true,
          brand: { select: { name: true } },
        },
      }),
    ])

    const days = sold.map((p) => daysBetween(p.createdAt, p.soldAt!))
    const group = <K extends string | number>(key: (i: number) => K) => {
      const map = new Map<K, number[]>()
      sold.forEach((_, i) => map.set(key(i), [...(map.get(key(i)) ?? []), i]))
      return [...map.entries()]
    }
    const byCategory = group((i) => sold[i]!.category.name)
      .map(([name, idx]) => ({
        name,
        sold: idx.length,
        averageDays: round1(average(idx.map((i) => days[i]!))),
      }))
      .sort((a, b) => b.sold - a.sold)
    const fastest = [...byCategory].sort((a, b) => a.averageDays - b.averageDays)[0]

    return {
      period: { from: toWibDate(from), to: toWibDate(now) },
      sold: sold.length,
      averageDaysToSell: days.length ? round1(average(days)) : null,
      fastestCategory: fastest ? { name: fastest.name, averageDays: fastest.averageDays } : null,
      byBrand: group((i) => sold[i]!.brand.name)
        .map(([name, idx]) => ({
          name,
          sold: idx.length,
          averagePrice: Math.round(average(idx.map((i) => sold[i]!.price))),
          averageDays: round1(average(idx.map((i) => days[i]!))),
        }))
        .sort((a, b) => b.sold - a.sold),
      byCategory,
      bySize: group((i) => Number(sold[i]!.sizeEu))
        .map(([sizeEu, idx]) => ({ sizeEu, sold: idx.length }))
        .sort((a, b) => a.sizeEu - b.sizeEu),
      slowMoving: {
        total: slowTotal,
        items: slow.map((p) => ({
          id: p.id,
          code: p.code,
          photoUrl: p.photos[0]?.url ?? null,
          name: `${p.brand.name} ${p.model}`,
          sizeEu: Number(p.sizeEu),
          price: p.price,
          days: Math.floor(daysBetween(p.createdAt, now)),
        })),
      },
    }
  }
}
