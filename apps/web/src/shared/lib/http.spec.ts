import { afterEach, describe, expect, it, vi } from 'vitest'
import { markOnline } from './connection'
import { http, setUnauthenticatedHandler } from './http'

const reply = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }))

afterEach(() => {
  markOnline()
  vi.unstubAllGlobals()
})

describe('http: sesi berakhir', () => {
  it('401 UNAUTHENTICATED memanggil handler sesi berakhir', async () => {
    const handler = vi.fn()
    setUnauthenticatedHandler(handler)
    vi.stubGlobal('fetch', reply(401, { code: 'UNAUTHENTICATED', message: 'Sesi berakhir' }))
    await expect(http.get('/panel/dashboard')).rejects.toMatchObject({ status: 401 })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('401 karena salah password dan error lain tidak dianggap sesi berakhir', async () => {
    const handler = vi.fn()
    setUnauthenticatedHandler(handler)
    vi.stubGlobal('fetch', reply(401, { code: 'INVALID_CREDENTIALS', message: 'Salah' }))
    await expect(http.post('/auth/login', {})).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
    vi.stubGlobal('fetch', reply(403, { code: 'FORBIDDEN', message: 'Tidak boleh' }))
    await expect(http.get('/owner/dashboard')).rejects.toMatchObject({ status: 403 })
    expect(handler).not.toHaveBeenCalled()
  })
})
