import { Controller, Get } from '@nestjs/common'
import { Roles } from '../../common/auth/auth.decorators.js'
import { OrdersPanelService } from './orders.panel.service.js'

// Dashboard pegawai (layar P-Dashboard): jumlah tugas, tanpa angka Rp ([KONFIRMASI] no. 6).
@Roles('STAFF', 'OWNER')
@Controller('panel/dashboard')
export class DashboardPanelController {
  constructor(private readonly panel: OrdersPanelService) {}

  @Get()
  dashboard() {
    return this.panel.dashboard()
  }
}
