import { ServiceUnavailableException } from '@nestjs/common'
import { createTransport } from 'nodemailer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getEnv } from '../../config/env.js'
import { MailService } from './mail.service.js'

const sendMail = vi.fn()
vi.mock('nodemailer', () => ({ createTransport: vi.fn(() => ({ sendMail })) }))
vi.mock('../../config/env.js', () => ({ getEnv: vi.fn() }))

const base = {
  NODE_ENV: 'development',
  SMTP_PORT: 587,
  MAIL_FROM: 'Toko <no-reply@toko.test>',
} as ReturnType<typeof getEnv>
const message = { to: 'rina@mail.test', subject: 'Halo', text: 'Isi' }

describe('MailService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('tanpa SMTP_HOST: tidak membuat koneksi SMTP, email hanya dicetak ke log', async () => {
    vi.mocked(getEnv).mockReturnValue(base)
    await new MailService().send(message)
    expect(createTransport).not.toHaveBeenCalled()
  })

  it('dengan SMTP_HOST: mengirim lewat SMTP dengan alamat pengirim MAIL_FROM', async () => {
    vi.mocked(getEnv).mockReturnValue({
      ...base,
      SMTP_HOST: 'smtp.toko.test',
      SMTP_PORT: 465,
      SMTP_USER: 'u',
      SMTP_PASS: 'p',
    })
    sendMail.mockResolvedValue({})
    await new MailService().send(message)
    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.toko.test',
      port: 465,
      secure: true,
      auth: { user: 'u', pass: 'p' },
    })
    expect(sendMail).toHaveBeenCalledWith({ from: 'Toko <no-reply@toko.test>', ...message })
  })

  it('SMTP gagal: 503 MAIL_FAILED dengan pesan yang bisa dibaca pengguna', async () => {
    vi.mocked(getEnv).mockReturnValue({ ...base, SMTP_HOST: 'smtp.toko.test' })
    sendMail.mockRejectedValue(new Error('Connection refused'))
    const err = await new MailService().send(message).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ServiceUnavailableException)
    expect((err as ServiceUnavailableException).getResponse()).toMatchObject({
      code: 'MAIL_FAILED',
    })
  })
})
