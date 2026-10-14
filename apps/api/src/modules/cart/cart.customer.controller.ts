import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common'
import type { AuthUserDto } from '@ssb/shared'
import { Type } from 'class-transformer'
import { IsInt } from 'class-validator'
import { CurrentUser, Roles } from '../../common/auth/auth.decorators.js'
import { CartService } from './cart.service.js'

class AddCartItemDto {
  @Type(() => Number)
  @IsInt({ message: 'productId harus angka' })
  productId!: number
}

@Roles('CUSTOMER')
@Controller('cart')
export class CartCustomerController {
  constructor(private readonly cart: CartService) {}

  @Get()
  get(@CurrentUser() user: AuthUserDto) {
    return this.cart.get(user.id)
  }

  @Post('items')
  add(@Body() dto: AddCartItemDto, @CurrentUser() user: AuthUserDto) {
    return this.cart.add(user.id, dto.productId)
  }

  @Delete('items/:productId')
  remove(@Param('productId', ParseIntPipe) productId: number, @CurrentUser() user: AuthUserDto) {
    return this.cart.remove(user.id, productId)
  }
}
