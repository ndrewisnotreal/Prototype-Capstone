import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import type { AuthUserDto } from '@ssb/shared'
import { memoryStorage } from 'multer'
import { CurrentUser, Roles } from '../../common/auth/auth.decorators.js'
import { MAX_UPLOAD_BYTES } from '../files/storage.service.js'
import {
  CreateProductDto,
  PanelProductListQueryDto,
  ProductStatusDto,
  ReorderPhotosDto,
  UpdateProductDto,
} from './products.panel.dto.js'
import { ProductsService } from './products.service.js'

// Batas multer dibuat longgar (10); jumlah 3-6 dicek di service supaya pesannya jelas dalam Bahasa Indonesia
const photoUpload = FilesInterceptor('photos', 10, {
  storage: memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
})

@Roles('STAFF', 'OWNER')
@Controller('panel/products')
export class ProductsPanelController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: PanelProductListQueryDto) {
    return this.products.listPanel(query)
  }

  // Di atas ':id', kalau tidak "status-counts" ditolak ParseIntPipe
  @Get('status-counts')
  statusCounts() {
    return this.products.statusCounts()
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.products.findPanelById(id)
  }

  /** multipart/form-data: field produk + `photos` (3-6 file) */
  @Post()
  @UseInterceptors(photoUpload)
  create(
    @Body() dto: CreateProductDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.products.create(dto, files, user.id)
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.products.update(id, dto, user.id)
  }

  @Patch(':id/status')
  setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProductStatusDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.products.setStatus(id, dto.status, user.id)
  }

  @Post(':id/photos')
  @UseInterceptors(photoUpload)
  addPhotos(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.products.addPhotos(id, files, user.id)
  }

  /** Atur urutan dan foto utama sekaligus */
  @Patch(':id/photos')
  reorderPhotos(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReorderPhotosDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.products.reorderPhotos(id, dto, user.id)
  }

  @Delete(':id/photos/:photoId')
  removePhoto(
    @Param('id', ParseIntPipe) id: number,
    @Param('photoId', ParseIntPipe) photoId: number,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.products.removePhoto(id, photoId, user.id)
  }
}
