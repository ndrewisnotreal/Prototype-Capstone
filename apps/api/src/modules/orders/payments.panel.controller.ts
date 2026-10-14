import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common'
import type { AuthUserDto } from '@ssb/shared'
import { CurrentUser, Roles } from '../../common/auth/auth.decorators.js'
import { StaffReasonDto } from './orders.dto.js'
import { OrdersPanelService } from './orders.panel.service.js'
import { OrdersService } from './orders.service.js'

// Verifikasi pembayaran (layar P-Verifikasi). File bukti lewat GET /files/payment-proofs/:id.
@Roles('STAFF', 'OWNER')
@Controller('panel/payments')
export class PaymentsPanelController {
  constructor(
    private readonly orders: OrdersService,
    private readonly panel: OrdersPanelService,
  ) {}

  @Get('pending')
  pending() {
    return this.panel.pendingProofs()
  }

  @Post(':proofId/accept')
  async accept(@Param('proofId', ParseIntPipe) proofId: number, @CurrentUser() user: AuthUserDto) {
    return this.panel.detail(await this.orders.acceptProof(user.id, proofId))
  }

  @Post(':proofId/reject')
  async reject(
    @Param('proofId', ParseIntPipe) proofId: number,
    @Body() dto: StaffReasonDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.panel.detail(await this.orders.rejectProof(user.id, proofId, dto.reason))
  }
}
