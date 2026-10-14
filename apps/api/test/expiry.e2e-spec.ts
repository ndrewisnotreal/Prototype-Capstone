import 'reflect-metadata'
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { OrderStatus, PaymentStatus } from '@prisma/client'
import { AppModule } from '../src/app.module.js'
import { setupApp } from '../src/app.setup.js'
import { EXPIRED_REASON, OrdersService } from '../src/modules/orders/orders.service.js'
import { PrismaService } from '../src/prisma/prisma.service.js'

const HOUR = 60 * 60 * 1000
const now = new Date('2026-10-11T12:00:00Z')

describe('Pesanan kedaluwarsa (e2e, database schema e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let orders: OrdersService
  let customerId: number
  let brandId: number
  let categoryId: number
  let seq = 0

  /** Pesanan dengan sepatu RESERVED; `expiresIn` jam relatif terhadap `now` (negatif = sudah lewat). */
  async function order(
    expiresIn: number,
    status: OrderStatus = 'AWAITING_PAYMENT',
    paymentStatus: PaymentStatus = 'UNPAID',
  ) {
    const product = await prisma.product.create({
      data: {
        code: `E-${++seq}`,
        model: 'Kobe',
        price: 300000,
        status: 'RESERVED',
        sizeEu: 43,
        condition: 'GOOD',
        brandId,
        categoryId,
      },
    })
    const o = await prisma.order.create({
      data: {
        code: `INV-TEST-${seq}`,
        customerId,
        status,
        paymentStatus,
        fulfillment: 'PICKUP',
        recipientName: 'Rina',
        recipientPhone: '081234567890',
        totalAmount: 300000,
        expiresAt: new Date(now.getTime() + expiresIn * HOUR),
        items: {
          create: {
            productId: product.id,
            price: 300000,
            brandName: 'Nike',
            model: 'Kobe',
            sizeEu: 43,
            condition: 'GOOD',
          },
        },
      },
    })
    return { orderId: o.id, productId: product.id }
  }
  const state = async (ids: { orderId: number; productId: number }) => {
    const o = await prisma.order.findUniqueOrThrow({
      where: { id: ids.orderId },
      include: { history: true },
    })
    const p = await prisma.product.findUniqueOrThrow({ where: { id: ids.productId } })
    return {
      order: o.status,
      payment: o.paymentStatus,
      reason: o.cancelReason,
      product: p.status,
      history: o.history,
    }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = setupApp(moduleRef.createNestApplication())
    await app.init()
    prisma = app.get(PrismaService)
    orders = app.get(OrdersService)
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Product", "Brand", "Category", "User", "Order" RESTART IDENTITY CASCADE',
    )
    customerId = (
      await prisma.user.create({ data: { name: 'C', email: 'c@e2e.test', passwordHash: 'x' } })
    ).id
    brandId = (await prisma.brand.create({ data: { name: 'Nike' } })).id
    categoryId = (await prisma.category.create({ data: { name: 'Basket', slug: 'basket' } })).id
  })

  afterAll(() => app.close())

  it('membatalkan yang lewat batas, mengembalikan sepatu, mencatat history sistem; sisanya tidak disentuh', async () => {
    const overdue = await order(-1)
    const rejectedOverdue = await order(-0.1, 'AWAITING_PAYMENT', 'REJECTED')
    const notYet = await order(+2)
    const verifying = await order(-5, 'AWAITING_VERIFICATION', 'PENDING_VERIFICATION')

    expect(await orders.expireOverdue(now)).toBe(2)

    expect(await state(overdue)).toMatchObject({
      order: 'CANCELLED',
      payment: 'UNPAID',
      reason: EXPIRED_REASON,
      product: 'AVAILABLE',
      history: [
        {
          fromStatus: 'AWAITING_PAYMENT',
          toStatus: 'CANCELLED',
          note: EXPIRED_REASON,
          actorId: null,
        },
      ],
    })
    // Status pembayaran dicatat apa adanya (business-rules: CANCELLED | apa pun)
    expect(await state(rejectedOverdue)).toMatchObject({
      order: 'CANCELLED',
      payment: 'REJECTED',
      product: 'AVAILABLE',
    })
    expect(await state(notYet)).toMatchObject({
      order: 'AWAITING_PAYMENT',
      product: 'RESERVED',
      history: [],
    })
    // Bukti sudah masuk: menunggu pegawai, tidak boleh kedaluwarsa
    expect(await state(verifying)).toMatchObject({
      order: 'AWAITING_VERIFICATION',
      product: 'RESERVED',
    })
  })

  it('aman diulang dan aman bila dua putaran berjalan bersamaan', async () => {
    const a = await order(-1)
    const b = await order(-1)
    const [n1, n2] = await Promise.all([orders.expireOverdue(now), orders.expireOverdue(now)])
    expect(n1 + n2).toBe(2)
    expect(await orders.expireOverdue(now)).toBe(0)
    for (const ids of [a, b]) expect((await state(ids)).history).toHaveLength(1)
  })

  it('hanya sepatu yang masih RESERVED yang dikembalikan ke AVAILABLE', async () => {
    const ids = await order(-1)
    // Hanya sepatu yang masih RESERVED yang dikembalikan; status lain (mis. SOLD) dibiarkan apa adanya
    await prisma.product.update({ where: { id: ids.productId }, data: { status: 'SOLD' } })
    await orders.expireOverdue(now)
    expect(await state(ids)).toMatchObject({ order: 'CANCELLED', product: 'SOLD' })
  })
})
