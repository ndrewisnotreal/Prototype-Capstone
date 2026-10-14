import { Controller, Get, Param, ParseIntPipe, Res } from '@nestjs/common'
import type { AuthUserDto } from '@ssb/shared'
import type { Response } from 'express'
import { CurrentUser, Roles } from '../../common/auth/auth.decorators.js'
import { OrdersService } from './orders.service.js'

// Bukti transfer TIDAK pernah publik: hanya pemilik pesanan, pegawai, owner.
@Roles('CUSTOMER', 'STAFF', 'OWNER')
@Controller('files/payment-proofs')
export class PaymentProofFilesController {
  constructor(private readonly orders: OrdersService) {}

  @Get(':id')
  async file(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUserDto,
    @Res() res: Response,
  ) {
    const { path, contentType } = await this.orders.proofFile(user, id)
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.sendFile(path, (err) => {
      // File hilang dari disk: jawab dengan format error biasa, bukan halaman error Express
      if (err && !res.headersSent) {
        res.status(404).json({
          statusCode: 404,
          code: 'PROOF_NOT_FOUND',
          message: 'File bukti transfer tidak ditemukan.',
        })
      }
    })
  }
}
