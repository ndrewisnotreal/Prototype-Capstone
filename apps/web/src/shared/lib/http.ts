import type { ApiError } from '@ssb/shared'
import { markOffline, markOnline } from './connection'

// Semua panggilan API lewat sini. Web dan API satu origin (proxy /api), jadi cookie sesi ikut otomatis (ADR-0003).
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

let onUnauthenticated: (() => void) | undefined
/** Dipasang router: sesi berakhir (401 UNAUTHENTICATED) saat aplikasi terbuka → keluar dan kembali ke Masuk. */
export function setUnauthenticatedHandler(handler: () => void) {
  onUnauthenticated = handler
}

async function request<T>(method: string, path: string, body?: unknown | FormData): Promise<T> {
  const isForm = body instanceof FormData
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      // FormData: browser yang mengisi Content-Type multipart beserta boundary-nya
      headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  } catch {
    markOffline()
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Koneksi terputus. Cek internet lalu coba lagi.')
  }
  markOnline()
  if (res.status === 204) return undefined as T

  const data: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const err = (data ?? {}) as Partial<ApiError>
    // INVALID_CREDENTIALS (salah password) juga 401 tetapi bukan sesi berakhir, jadi dicek kodenya
    if (res.status === 401 && err.code === 'UNAUTHENTICATED') onUnauthenticated?.()
    throw new ApiRequestError(
      res.status,
      err.code ?? 'ERROR',
      err.message ?? 'Terjadi kesalahan. Coba lagi sebentar.',
      err.details,
    )
  }
  return data as T
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  /** body opsional, mis. konfirmasi password saat menghapus rekening */
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
  /** multipart/form-data (unggah foto) */
  upload: <T>(method: 'POST' | 'PATCH', path: string, form: FormData) =>
    request<T>(method, path, form),
}
