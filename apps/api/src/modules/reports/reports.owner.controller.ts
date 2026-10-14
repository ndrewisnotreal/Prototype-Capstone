import { Controller, Get, Query, StreamableFile } from '@nestjs/common'
import { Roles } from '../../common/auth/auth.decorators.js'
import {
  DashboardQueryDto,
  PerformanceQueryDto,
  SalesExportQueryDto,
  SalesReportQueryDto,
} from './reports.dto.js'
import { salesReportFilename, salesReportPdf, salesReportXlsx } from './reports.export.js'
import { ReportsService } from './reports.service.js'

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Dashboard owner, laporan penjualan + ekspor, performa produk (layar O-Dashboard, O-Laporan, O-Performa).
@Roles('OWNER')
@Controller('owner')
export class ReportsOwnerController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  dashboard(@Query() q: DashboardQueryDto) {
    return this.reports.dashboard(q.granularity ?? 'month')
  }

  @Get('reports/sales')
  sales(@Query() q: SalesReportQueryDto) {
    return this.reports.salesReport(q)
  }

  @Get('reports/sales/export')
  async export(@Query() q: SalesExportQueryDto) {
    const report = await this.reports.salesReport(q)
    const pdf = q.format === 'pdf'
    return new StreamableFile(pdf ? await salesReportPdf(report) : await salesReportXlsx(report), {
      type: pdf ? 'application/pdf' : XLSX_TYPE,
      disposition: `attachment; filename="${salesReportFilename(report, q.format)}"`,
    })
  }

  @Get('reports/performance')
  performance(@Query() q: PerformanceQueryDto) {
    return this.reports.performance(q.period ?? '3m')
  }
}
