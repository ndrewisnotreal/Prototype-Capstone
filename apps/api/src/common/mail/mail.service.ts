import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { createTransport, type Transporter } from 'nodemailer'
import { getEnv } from '../../config/env.js'

export interface MailMessage {
  to: string
  subject: string
  text: string
}

// Email lewat SMTP bila SMTP_HOST diisi (ADR-0009). Kosong = hanya dicetak ke log (dev, demo tanpa email).
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail')
  private readonly transport: Transporter | null
  private readonly from: string

  constructor() {
    const env = getEnv()
    this.from = env.MAIL_FROM
    this.transport = env.SMTP_HOST
      ? createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465, // 465 = TLS langsung, 587/25 = STARTTLS
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
        })
      : null
    if (!this.transport && env.NODE_ENV === 'production')
      this.logger.warn('SMTP_HOST kosong: email hanya dicetak ke log, tidak terkirim.')
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transport) {
      this.logger.log(`Ke: ${message.to} | ${message.subject}\n${message.text}`)
      return
    }
    try {
      await this.transport.sendMail({ from: this.from, ...message })
    } catch (e) {
      this.logger.error(`Gagal mengirim email ke ${message.to}: ${(e as Error).message}`)
      throw new ServiceUnavailableException({
        code: 'MAIL_FAILED',
        message: 'Email belum bisa dikirim. Coba lagi sebentar.',
      })
    }
  }
}
