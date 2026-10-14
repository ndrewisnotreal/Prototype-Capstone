import { Controller, Get, Param, Query } from '@nestjs/common'
import { Public } from '../../common/auth/auth.decorators.js'
import { ProductListQueryDto } from './products.dto.js'
import { ProductsService } from './products.service.js'

@Public()
@Controller('products')
export class ProductsPublicController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: ProductListQueryDto) {
    return this.products.listPublic(query)
  }

  // Harus di atas ':code', kalau tidak "recently-sold" dianggap kode produk
  @Get('recently-sold')
  recentlySold() {
    return this.products.recentlySold()
  }

  @Get(':code')
  detail(@Param('code') code: string) {
    return this.products.findPublicByCode(code)
  }

  @Get(':code/similar')
  similar(@Param('code') code: string) {
    return this.products.findSimilar(code)
  }
}
