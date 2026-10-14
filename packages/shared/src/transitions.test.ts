import { describe, expect, it } from 'vitest'
import {
  assertTransition,
  canTransition,
  InvalidTransitionError,
  ORDER_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  PRODUCT_TRANSITIONS,
} from './transitions.js'

describe('PRODUCT_TRANSITIONS', () => {
  it.each([
    ['AVAILABLE', 'RESERVED'],
    ['RESERVED', 'AVAILABLE'],
    ['RESERVED', 'SOLD'],
    ['AVAILABLE', 'INACTIVE'],
    ['INACTIVE', 'AVAILABLE'],
  ] as const)('%s -> %s sah', (from, to) => {
    expect(canTransition(PRODUCT_TRANSITIONS, from, to)).toBe(true)
  })

  it.each([
    ['RESERVED', 'INACTIVE'], // sedang dipesan, tidak bisa dinonaktifkan
    ['SOLD', 'INACTIVE'],
    ['AVAILABLE', 'SOLD'], // harus lewat reservasi
    ['INACTIVE', 'RESERVED'],
  ] as const)('%s -> %s ditolak', (from, to) => {
    expect(canTransition(PRODUCT_TRANSITIONS, from, to)).toBe(false)
  })
})

describe('ORDER_TRANSITIONS', () => {
  it('jalur ambil di toko dan jalur kirim sampai selesai', () => {
    const head = ['AWAITING_PAYMENT', 'AWAITING_VERIFICATION', 'PROCESSING'] as const
    for (const path of [
      [...head, 'READY_FOR_PICKUP', 'COMPLETED'] as const,
      [...head, 'SHIPPED', 'COMPLETED'] as const,
    ]) {
      for (let i = 1; i < path.length; i++) {
        expect(() => assertTransition(ORDER_TRANSITIONS, path[i - 1], path[i])).not.toThrow()
      }
    }
  })

  it('bukti ditolak kembali ke AWAITING_PAYMENT', () => {
    expect(canTransition(ORDER_TRANSITIONS, 'AWAITING_VERIFICATION', 'AWAITING_PAYMENT')).toBe(true)
  })

  it('pembatalan hanya dari tiga status awal', () => {
    const cancellable = Object.entries(ORDER_TRANSITIONS)
      .filter(([, next]) => next.includes('CANCELLED'))
      .map(([from]) => from)
    expect(cancellable).toEqual(['AWAITING_PAYMENT', 'AWAITING_VERIFICATION', 'PROCESSING'])
  })

  it('status akhir tidak punya transisi', () => {
    expect(ORDER_TRANSITIONS.COMPLETED).toEqual([])
    expect(ORDER_TRANSITIONS.CANCELLED).toEqual([])
  })

  it('assertTransition melempar InvalidTransitionError dengan code', () => {
    expect(() => assertTransition(ORDER_TRANSITIONS, 'COMPLETED', 'PROCESSING')).toThrow(
      InvalidTransitionError,
    )
    expect(new InvalidTransitionError('A', 'B').code).toBe('INVALID_TRANSITION')
  })
})

describe('PAYMENT_TRANSITIONS', () => {
  it('ditolak boleh unggah ulang, terverifikasi final', () => {
    expect(canTransition(PAYMENT_TRANSITIONS, 'REJECTED', 'PENDING_VERIFICATION')).toBe(true)
    expect(canTransition(PAYMENT_TRANSITIONS, 'UNPAID', 'VERIFIED')).toBe(false)
    expect(PAYMENT_TRANSITIONS.VERIFIED).toEqual([])
  })
})
