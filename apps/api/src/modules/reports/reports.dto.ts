import { Fulfillment, type PerformancePeriod, type ReportGranularity } from '@ssb/shared'
import { IsIn, IsOptional, Matches } from 'class-validator'

const DATE = /^\d{4}-\d{2}-\d{2}$/

export class DashboardQueryDto {
  @IsOptional()
  @IsIn(['day', 'week', 'month'], { message: 'Pilih harian, mingguan, atau bulanan' })
  granularity?: ReportGranularity
}

export class SalesReportQueryDto {
  @Matches(DATE, { message: 'Tanggal "dari" format YYYY-MM-DD' })
  from!: string

  @Matches(DATE, { message: 'Tanggal "sampai" format YYYY-MM-DD' })
  to!: string

  @IsOptional()
  @IsIn(Object.values(Fulfillment), { message: 'Metode tidak dikenal' })
  fulfillment?: Fulfillment
}

export class SalesExportQueryDto extends SalesReportQueryDto {
  @IsIn(['pdf', 'xlsx'], { message: 'Format ekspor pdf atau xlsx' })
  format!: 'pdf' | 'xlsx'
}

export class PerformanceQueryDto {
  @IsOptional()
  @IsIn(['3m', '6m', 'ytd'], { message: 'Periode 3m, 6m, atau ytd' })
  period?: PerformancePeriod
}
