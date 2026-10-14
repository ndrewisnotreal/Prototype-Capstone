import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import type { AuthUserDto } from '@ssb/shared'
import { CurrentUser, Roles } from '../../common/auth/auth.decorators.js'
import { PanelOrderListQueryDto, ShipOrderDto, StaffReasonDto } from './orders.dto.js'
import { OrdersPanelService } from './orders.panel.service.js'
import { OrdersService } from './orders.service.js'

// Kelola pesanan (layar P-Pesanan). Aksi mengembalikan detail terbaru untuk drawer.
@Roles('STAFF', 'OWNER')
@Controller('panel/orders')
export class OrdersPanelController {
  constructor(
    private readonly orders: OrdersService,
    private readonly panel: OrdersPanelService,
  ) {}

  @Get()
  list(@Query() query: PanelOrderListQueryDto) {
    return this.panel.list(query)
  }

  // Sebelum ':code' supaya "counts" tidak dianggap kode pesanan
  @Get('counts')
  counts() {
    return this.panel.counts()
  }

  @Get(':code')
  detail(@Param('code') code: string) {
    return this.panel.detail(code)
  }

  @Post(':code/ready')
  async ready(@Param('code') code: string, @CurrentUser() user: AuthUserDto) {
    return this.panel.detail(await this.orders.markReady(user.id, code))
  }

  @Post(':code/ship')
  async ship(
    @Param('code') code: string,
    @Body() dto: ShipOrderDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.panel.detail(
      await this.orders.markShipped(user.id, code, dto.courier, dto.trackingNumber),
    )
  }

  @Post(':code/complete')
  async complete(@Param('code') code: string, @CurrentUser() user: AuthUserDto) {
    return this.panel.detail(await this.orders.markCompleted(user.id, code))
  }

  @Post(':code/cancel')
  async cancel(
    @Param('code') code: string,
    @Body() dto: StaffReasonDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.panel.detail(await this.orders.cancelByStaff(user.id, code, dto.reason))
  }
}
