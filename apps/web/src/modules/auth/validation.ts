// Aturan sama dengan DTO backend (apps/api/src/modules/auth/auth.dto.ts) supaya pesan muncul di field yang tepat
// sebelum dikirim. Backend tetap memvalidasi ulang.
export const PHONE_PATTERN = /^(\+62|62|0)8\d{7,12}$/

export const rules = {
  name: (v: string) => (v.trim().length < 2 ? 'Nama minimal 2 karakter' : ''),
  email: (v: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
      ? ''
      : 'Format email belum benar, contoh: nama@gmail.com',
  phone: (v: string) =>
    PHONE_PATTERN.test(v.replace(/[\s-]/g, ''))
      ? ''
      : 'Nomor WhatsApp belum benar, contoh 081234567890',
  password: (v: string) =>
    v.length < 8
      ? 'Password minimal 8 karakter.'
      : v.length > 72
        ? 'Password maksimal 72 karakter.'
        : '',
}

export const required = (label: string) => (v: string) => (v ? '' : `${label} wajib diisi`)

/** Isi errors dari aturan per field; true kalau semua lolos. */
export function validate<K extends string>(
  values: Record<K, string>,
  fieldRules: Record<K, (v: string) => string>,
  errors: Record<K, string>,
): boolean {
  let ok = true
  for (const key of Object.keys(fieldRules) as K[]) {
    errors[key] = fieldRules[key](values[key])
    if (errors[key]) ok = false
  }
  return ok
}

/** 0-4 bar untuk meteran password di layar Reset. Syarat minimal tetap 8 karakter. */
export function passwordStrength(v: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!v) return { score: 0, label: '' }
  if (v.length < 8) return { score: 1, label: 'Terlalu pendek. Minimal 8 karakter.' }
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(v)).length
  if (v.length >= 12 && variety >= 3) return { score: 4, label: 'Sangat kuat.' }
  if (variety >= 2) return { score: 3, label: 'Kuat. Minimal 8 karakter terpenuhi.' }
  return { score: 2, label: 'Cukup. Tambahkan angka atau simbol supaya lebih kuat.' }
}
