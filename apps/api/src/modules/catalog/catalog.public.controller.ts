import { Controller, Get } from '@nestjs/common'
import { Public } from '../../common/auth/auth.decorators.js'
import { CatalogService } from './catalog.service.js'

@Public()
@Controller('catalog')
export class CatalogPublicController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('brands')
  brands() {
    return this.catalog.brands()
  }

  @Get('categories')
  categories() {
    return this.catalog.categories()
  }
}
