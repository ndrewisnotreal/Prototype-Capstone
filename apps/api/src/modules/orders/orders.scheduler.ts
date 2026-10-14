import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { getEnv } from '../../config/env.js'
import { OrdersService } from './orders.service.js'

const EVERY_MINUTE = 60_000

/** Tiap menit: batalkan pesanan yang lewat batas bayar. Tidak berjalan saat test (dipanggil langsung di sana). */
@Injectable()
export class OrdersExpiryScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('OrdersExpiry')
  private timer?: NodeJS.Timeout
  private running = false

  constructor(private readonly orders: OrdersService) {}

  onApplicationBootstrap() {
    if (getEnv().NODE_ENV === 'test') return
    this.timer = setInterval(() => void this.tick(), EVERY_MINUTE)
    void this.tick() // juga sekali saat start, supaya pesanan yang lewat selama server mati langsung dibereskan
  }

  onModuleDestroy() {
    clearInterval(this.timer)
  }

  async tick() {
    if (this.running) return // putaran sebelumnya belum selesai
    this.running = true
    try {
      const n = await this.orders.expireOverdue()
      if (n) this.logger.log(`${n} pesanan dibatalkan karena lewat batas waktu pembayaran`)
    } catch (e) {
      this.logger.error('Gagal memproses pesanan kedaluwarsa', e)
    } finally {
      this.running = false
    }
  }
}
