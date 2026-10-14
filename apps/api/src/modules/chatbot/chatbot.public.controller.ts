import { Body, Controller, Get, HttpCode, HttpException, Ip, Post } from '@nestjs/common'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator'
import { Public } from '../../common/auth/auth.decorators.js'
import { ChatbotService } from './chatbot.service.js'

class ChatMessageInput {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant'

  @IsString()
  @Length(1, 500, { message: 'Pesan 1 sampai 500 karakter' })
  text!: string
}

class ChatRequestDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Tulis pertanyaan dulu' })
  @ArrayMaxSize(10, { message: 'Riwayat percakapan maksimal 10 pesan' })
  @ValidateNested({ each: true })
  @Type(() => ChatMessageInput)
  messages!: ChatMessageInput[]
}

/** Batas pesan per IP agar kuota AI tidak habis oleh satu pengguna */
export const CHAT_RATE_LIMIT = { max: 20, windowMs: 10 * 60 * 1000 }

// Chatbot publik (pengunjung dan semua role)
@Public()
@Controller('chat')
export class ChatbotPublicController {
  // shortcut: hitungan di memori proses; pindah ke Redis bila API dijalankan lebih dari 1 instance
  private readonly hits = new Map<string, number[]>()

  constructor(private readonly chatbot: ChatbotService) {}

  @Get('faqs')
  faqs() {
    return this.chatbot.faqs()
  }

  @Post()
  @HttpCode(200)
  chat(@Body() dto: ChatRequestDto, @Ip() ip: string) {
    this.limit(ip)
    if (dto.messages.at(-1)!.role !== 'user') {
      throw new HttpException(
        { code: 'VALIDATION_ERROR', message: 'Pesan terakhir harus dari customer.' },
        400,
      )
    }
    return this.chatbot.reply(dto.messages)
  }

  private limit(ip: string) {
    const now = Date.now()
    const recent = (this.hits.get(ip) ?? []).filter((t) => now - t < CHAT_RATE_LIMIT.windowMs)
    if (recent.length >= CHAT_RATE_LIMIT.max) {
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Terlalu banyak pertanyaan. Coba lagi beberapa menit lagi.',
        },
        429,
      )
    }
    recent.push(now)
    this.hits.set(ip, recent)
  }
}
