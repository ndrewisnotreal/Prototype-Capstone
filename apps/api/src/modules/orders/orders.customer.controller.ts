import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { AuthUserDto } from '@ssb/shared'
import { memoryStorage } from 'multer'
import { CurrentUser, Roles } from '../../common/auth/auth.decorators.js'
import { MAX_UPLOAD_BYTES } from '../files/storage.service.js'
import { CheckoutDto, OrderListQueryDto, SubmitProofDto } from './orders.dto.js'
import { OrdersService } from './orders.service.js'

@Roles('CUSTOMER')
@Controller('orders')
export class OrdersCustomerController {
  constructor(private readonly orders: OrdersService) {}

  @Post('checkout')
  async checkout(@Body() dto: CheckoutDto, @CurrentUser() user: AuthUserDto) {
    return { order: await this.orders.checkout(user.id, dto) }
  }

  @Get()
  list(@Query() query: OrderListQueryDto, @CurrentUser() user: AuthUserDto) {
    return this.orders.listForCustomer(user.id, query)
  }

  // Sebelum ':code' supaya "counts" tidak dianggap kode pesanan
  @Get('counts')
  counts(@CurrentUser() user: AuthUserDto) {
    return this.orders.countsForCustomer(user.id)
  }

  @Get(':code')
  detail(@Param('code') code: string, @CurrentUser() user: AuthUserDto) {
    return this.orders.detailForCustomer(user.id, code)
  }

  @Get(':code/payment-instructions')
  paymentInstructions(@Param('code') code: string, @CurrentUser() user: AuthUserDto) {
    return this.orders.paymentInstructions(user.id, code)
  }

  /** multipart/form-data: `file` (foto/PDF, maks 5 MB) + senderName, senderBank, amount */
  @Post(':code/payment-proofs')
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  submitProof(
    @Param('code') code: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: SubmitProofDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.orders.submitProof(user.id, code, file, dto)
  }

  @Post(':code/cancel')
  cancel(@Param('code') code: string, @CurrentUser() user: AuthUserDto) {
    return this.orders.cancelByCustomer(user.id, code)
  }

  // Juga untuk pegawai/owner (route /pesanan/:code/invoice); kepemilikan dicek di service
  @Roles('CUSTOMER', 'STAFF', 'OWNER')
  @Get(':code/invoice')
  invoice(@Param('code') code: string, @CurrentUser() user: AuthUserDto) {
    return this.orders.invoice(user, code)
  }
}
