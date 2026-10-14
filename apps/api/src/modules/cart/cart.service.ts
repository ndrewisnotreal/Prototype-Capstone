import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { CartDto } from '@ssb/shared'
import { PrismaService } from '../../prisma/prisma.service.js'
import { CARD_INCLUDE, toProductCard } from '../products/products.service.js'

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: number): Promise<CartDto> {
    const rows = await this.prisma.cartItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { product: { include: CARD_INCLUDE } },
    })
    const items = rows.map((r) => ({
      ...toProductCard(r.product),
      productId: r.productId,
      available: r.product.status === 'AVAILABLE',
      addedAt: r.createdAt.toISOString(),
    }))
    const available = items.filter((i) => i.available)
    return {
      items,
      availableCount: available.length,
      total: available.reduce((sum, i) => sum + i.price, 0),
    }
  }

  /** Hanya sepatu AVAILABLE yang bisa masuk; menambah yang sudah ada tidak dianggap error. */
  async add(userId: number, productId: number): Promise<CartDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { status: true },
    })
    if (!product || product.status === 'INACTIVE') {
      throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Sepatu tidak ditemukan.' })
    }
    if (product.status !== 'AVAILABLE') {
      throw new ConflictException({
        code: 'PRODUCT_NOT_AVAILABLE',
        message:
          product.status === 'SOLD'
            ? 'Maaf, sepatu ini sudah terjual.'
            : 'Maaf, sepatu ini sedang dipesan orang lain.',
      })
    }
    await this.prisma.cartItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    })
    return this.get(userId)
  }

  async remove(userId: number, productId: number): Promise<CartDto> {
    await this.prisma.cartItem.deleteMany({ where: { userId, productId } })
    return this.get(userId)
  }
}
