import { Module } from '@nestjs/common'
import { CartCustomerController } from './cart.customer.controller.js'
import { CartService } from './cart.service.js'

@Module({
  controllers: [CartCustomerController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
