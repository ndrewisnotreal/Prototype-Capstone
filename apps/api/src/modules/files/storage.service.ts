import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { getEnv } from '../../config/env.js'

/** Foto produk publik dilayani statis dari sini (lihat app.setup.ts). Bukti transfer TIDAK di folder ini. */
export const PRODUCT_PHOTO_URL_PREFIX = '/api/uploads/products/'
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export const uploadRoot = () => resolve(getEnv().UPLOAD_DIR)
export const productPhotoDir = () => join(uploadRoot(), 'products')
/** Bukti transfer: PRIVAT, tidak pernah dilayani statis (lihat FilesController). */
export const paymentProofDir = () => join(uploadRoot(), 'payment-proofs')

// Jenis file dari isi (magic bytes), bukan dari nama/MIME kiriman browser yang bisa dipalsukan
export function imageExtension(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'png'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
    return 'webp'
  return null
}

const isPdf = (buf: Buffer) => buf.toString('ascii', 0, 5) === '%PDF-'
export const PROOF_CONTENT_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
} as const

// shortcut: disk lokal tanpa resize/kompres; ganti ke object storage + resize (mis. sharp) sebelum produksi (T-7.4)
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)

  /** Simpan foto produk, kembalikan URL publiknya. Semua file dicek dulu, jadi tidak ada yang tersimpan setengah. */
  async saveProductPhotos(files: Express.Multer.File[]): Promise<string[]> {
    const exts = files.map((f) => imageExtension(f.buffer))
    const bad = files.find((_, i) => !exts[i])
    if (bad) {
      throw new BadRequestException({
        code: 'INVALID_IMAGE',
        message: `File "${bad.originalname}" bukan foto JPG, PNG, atau WebP.`,
      })
    }
    await mkdir(productPhotoDir(), { recursive: true })
    const names = exts.map((ext) => `${randomUUID()}.${ext}`)
    await Promise.all(
      names.map((name, i) => writeFile(join(productPhotoDir(), name), files[i].buffer)),
    )
    return names.map((name) => PRODUCT_PHOTO_URL_PREFIX + name)
  }

  /** Simpan bukti transfer (foto atau PDF) di folder privat; kembalikan fileKey untuk PaymentProof.fileKey. */
  async savePaymentProof(file: Express.Multer.File): Promise<string> {
    const ext = imageExtension(file.buffer) ?? (isPdf(file.buffer) ? 'pdf' : null)
    if (!ext) {
      throw new BadRequestException({
        code: 'INVALID_PROOF_FILE',
        message: 'Bukti transfer harus foto JPG, PNG, WebP, atau PDF.',
      })
    }
    await mkdir(paymentProofDir(), { recursive: true })
    const name = `${randomUUID()}.${ext}`
    await writeFile(join(paymentProofDir(), name), file.buffer)
    return name
  }

  /** Path absolut + jenis konten file bukti. basename: fileKey dari database tidak bisa keluar folder. */
  paymentProofFile(fileKey: string) {
    const name = basename(fileKey)
    const ext = name.split('.').pop() as keyof typeof PROOF_CONTENT_TYPES
    return {
      path: join(paymentProofDir(), name),
      contentType: PROOF_CONTENT_TYPES[ext] ?? 'application/octet-stream',
    }
  }

  async removePaymentProof(fileKey: string) {
    await unlink(join(paymentProofDir(), basename(fileKey))).catch(() => undefined)
  }

  /** Hapus file foto dari disk. Gagal hapus hanya dicatat: data di database tetap yang utama. */
  async removeProductPhotos(urls: string[]): Promise<void> {
    await Promise.all(
      urls
        .filter((u) => u.startsWith(PRODUCT_PHOTO_URL_PREFIX))
        .map((u) =>
          // basename: cegah path traversal dari URL yang tersimpan
          unlink(join(productPhotoDir(), basename(u))).catch((e: unknown) =>
            this.logger.warn(`Gagal menghapus ${u}: ${String(e)}`),
          ),
        ),
    )
  }
}
