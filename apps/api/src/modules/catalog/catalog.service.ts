import { Injectable } from '@nestjs/common'
import type { BrandDto, CategoryDto } from '@ssb/shared'
import { PrismaService } from '../../prisma/prisma.service.js'

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // Urutan masuk (id), bukan abjad: sama dengan urutan di filter desain Katalog
  brands(): Promise<BrandDto[]> {
    return this.prisma.brand.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } })
  }

  categories(): Promise<CategoryDto[]> {
    return this.prisma.category.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { id: 'asc' },
    })
  }
}
