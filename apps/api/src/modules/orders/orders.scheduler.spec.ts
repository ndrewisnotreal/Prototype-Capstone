import type { OrdersService } from './orders.service.js'
import { OrdersExpiryScheduler } from './orders.scheduler.js'

const make = (expireOverdue: () => Promise<number>) =>
  new OrdersExpiryScheduler({ expireOverdue } as unknown as OrdersService)

describe('OrdersExpiryScheduler', () => {
  it('putaran tidak tumpang-tindih bila yang sebelumnya belum selesai', async () => {
    let release!: (n: number) => void
    // hanya panggilan pertama yang menggantung; berikutnya langsung selesai
    const expire = vi
      .fn<() => Promise<number>>()
      .mockImplementationOnce(() => new Promise<number>((r) => (release = r)))
      .mockResolvedValue(0)
    const scheduler = make(expire)
    const first = scheduler.tick()
    await scheduler.tick() // langsung kembali, tidak memanggil lagi
    expect(expire).toHaveBeenCalledTimes(1)
    release(0)
    await first
    await scheduler.tick()
    expect(expire).toHaveBeenCalledTimes(2)
  })

  it('error database tidak menjatuhkan server dan putaran berikutnya tetap jalan', async () => {
    const expire = vi.fn().mockRejectedValueOnce(new Error('DB mati')).mockResolvedValueOnce(1)
    const scheduler = make(expire)
    await expect(scheduler.tick()).resolves.toBeUndefined()
    await scheduler.tick()
    expect(expire).toHaveBeenCalledTimes(2)
  })

  it('tidak memasang timer saat NODE_ENV=test', () => {
    const spy = vi.spyOn(globalThis, 'setInterval')
    make(vi.fn()).onApplicationBootstrap()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
