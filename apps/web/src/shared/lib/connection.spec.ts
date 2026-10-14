import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { useRequest } from '@/shared/composables'
import OfflineState from '@/shared/ui/OfflineState.vue'
import { RECONNECT_INTERVAL_MS, isOffline, markOnline } from './connection'
import { http } from './http'

const fetchMock = vi.fn()
const networkDown = () => fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
const networkUp = () =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
const flush = () => new Promise((r) => setTimeout(r))

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})
afterEach(() => {
  markOnline()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('status koneksi', () => {
  it('fetch gagal → offline, respons apa pun → online lagi', async () => {
    networkDown()
    await expect(http.get('/products')).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    expect(isOffline.value).toBe(true)

    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }))
    await expect(http.get('/products')).rejects.toMatchObject({ status: 500 })
    expect(isOffline.value).toBe(false)
  })

  it('selama putus, /api/health dicoba berkala sampai tersambung', async () => {
    vi.useFakeTimers()
    networkDown()
    await http.get('/products').catch(() => {})

    await vi.advanceTimersByTimeAsync(RECONNECT_INTERVAL_MS)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/health', expect.anything())
    expect(isOffline.value).toBe(true)

    networkUp()
    await vi.advanceTimersByTimeAsync(RECONNECT_INTERVAL_MS)
    expect(isOffline.value).toBe(false)
  })

  it('useRequest memuat ulang sendiri saat koneksi kembali', async () => {
    networkDown()
    let req!: ReturnType<typeof useRequest<{ ok: boolean }>>
    mount(
      defineComponent({
        setup() {
          req = useRequest(() => http.get<{ ok: boolean }>('/x'))
          return () => h('div')
        },
      }),
    )
    await flush()
    expect(req.errorCode.value).toBe('NETWORK_ERROR')

    networkUp()
    markOnline()
    await flush()
    expect(req.data.value).toEqual({ ok: true })
    expect(req.error.value).toBe('')
  })
})

describe('OfflineState', () => {
  it('tombol Coba lagi memancarkan retry; autoRetry memancarkan saat koneksi kembali', async () => {
    networkDown()
    await http.get('/x').catch(() => {})
    const manual = mount(OfflineState, { global: { stubs: { RouterLink: true } } })
    const auto = mount(OfflineState, {
      props: { autoRetry: true, contact: true },
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    expect(auto.text()).toContain('Hubungi WhatsApp resmi')

    await manual.get('button').trigger('click')
    expect(manual.emitted('retry')).toHaveLength(1)

    markOnline()
    await nextTick()
    expect(auto.emitted('retry')).toHaveLength(1)
    expect(manual.emitted('retry')).toHaveLength(1)
  })
})
