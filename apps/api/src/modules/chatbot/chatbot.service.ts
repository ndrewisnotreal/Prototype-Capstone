import { Inject, Injectable, Logger } from '@nestjs/common'
import type { Content, FunctionDeclaration } from '@google/genai'
import {
  CONDITION_LABELS,
  FULFILLMENT_LABELS,
  type ChatMessageDto,
  type ChatReplyDto,
  type OfficialChannelsDto,
  type ProductCardDto,
  type PublicFaqDto,
} from '@ssb/shared'
import { getEnv } from '../../config/env.js'
import { PrismaService } from '../../prisma/prisma.service.js'
import type { ProductListQueryDto } from '../products/products.dto.js'
import { ProductsService } from '../products/products.service.js'
import { StoreSettingsService } from '../store-settings/store-settings.service.js'
import { bestFaq, hasProductIntent, parseQuery } from './chatbot.fallback.js'
import { CHAT_MODEL, type ChatModel } from './gemini.client.js'

const MAX_PRODUCTS = 6
const MAX_TOOL_ROUNDS = 2
// per panggilan model; satu jawaban bisa 2-3 panggilan bila memakai tool
const AI_TIMEOUT_MS = 25_000

const SEARCH_TOOL: FunctionDeclaration = {
  name: 'cari_sepatu',
  description:
    'Cari sepatu yang masih tersedia di katalog toko. Pakai setiap kali customer menanyakan stok, merek, ukuran, harga, atau rekomendasi sepatu.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      merek: { type: 'string', description: 'Nama merek, mis. Nike' },
      ukuranEu: { type: 'number', description: 'Ukuran EU, mis. 42 atau 42.5' },
      hargaMaksimal: { type: 'integer', description: 'Batas harga dalam rupiah, mis. 500000' },
      hargaMinimal: { type: 'integer', description: 'Harga minimal dalam rupiah' },
      kataKunci: {
        type: 'string',
        description: 'Model atau kata lain, mis. "jordan" atau "running"',
      },
    },
  },
}
interface SearchArgs {
  merek?: string
  ukuranEu?: number
  hargaMaksimal?: number
  hargaMinimal?: number
  kataKunci?: string
}

/** Chatbot toko (requirements bagian 8): Gemini + tool pencarian; mode FAQ bila AI tidak tersedia atau gagal. */
@Injectable()
export class ChatbotService {
  private readonly logger = new Logger('Chatbot')

  constructor(
    @Inject(CHAT_MODEL) private readonly model: ChatModel | null,
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly store: StoreSettingsService,
  ) {}

  faqs(): Promise<PublicFaqDto[]> {
    return this.prisma.faq.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, question: true, answer: true },
    })
  }

  async reply(messages: ChatMessageDto[]): Promise<ChatReplyDto> {
    const faqs = await this.faqs()
    if (this.model) {
      try {
        return await this.aiReply(this.model, messages, faqs)
      } catch (e) {
        // AI gagal (kuota, jaringan, timeout): tetap menjawab lewat mode cadangan
        this.logger.warn(`Gemini gagal, pakai mode FAQ: ${(e as Error).message}`)
      }
    }
    return this.fallbackReply(messages.at(-1)!.text, faqs)
  }

  // ---------- mode AI ----------

  private async aiReply(
    model: ChatModel,
    messages: ChatMessageDto[],
    faqs: PublicFaqDto[],
  ): Promise<ChatReplyDto> {
    const store = await this.store.officialChannels().catch(() => null)
    const contents: Content[] = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }))
    let found: ProductCardDto[] = []

    for (let round = 0; ; round++) {
      const res = await model.generateContent({
        model: getEnv().GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: systemPrompt(store, faqs),
          tools: [{ functionDeclarations: [SEARCH_TOOL] }],
          temperature: 0.3,
          maxOutputTokens: 1024,
          abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
        },
      })
      const calls = res.functionCalls ?? []
      if (!calls.length || round >= MAX_TOOL_ROUNDS) {
        const text = res.text?.trim()
        if (!text) throw new Error('jawaban AI kosong')
        return { reply: text, products: found, mode: 'ai', suggestions: [] }
      }
      // simpan giliran model (berisi functionCall) lalu kirim hasil pencarian
      contents.push(
        res.candidates?.[0]?.content ?? {
          role: 'model',
          parts: calls.map((c) => ({ functionCall: c })),
        },
      )
      const parts = []
      for (const call of calls) {
        const result =
          call.name === SEARCH_TOOL.name ? await this.search((call.args ?? {}) as SearchArgs) : []
        found = result
        parts.push({
          functionResponse: {
            id: call.id,
            name: call.name,
            response: {
              jumlah: result.length,
              sepatu: result.map((p) => ({
                kode: p.code,
                merek: p.brand,
                model: p.model,
                ukuranEu: p.sizeEu,
                kondisi: CONDITION_LABELS[p.condition],
                harga: p.price,
              })),
            },
          },
        })
      }
      contents.push({ role: 'user', parts })
    }
  }

  /** Hanya sepatu AVAILABLE (hideReserved), maks 6 */
  private async search(args: SearchArgs): Promise<ProductCardDto[]> {
    const query: ProductListQueryDto = {
      hideReserved: true,
      limit: MAX_PRODUCTS,
      ...(args.merek && { brand: [args.merek] }),
      ...(args.ukuranEu && { size: [Number(args.ukuranEu)] }),
      ...(args.hargaMaksimal && { maxPrice: Math.round(Number(args.hargaMaksimal)) }),
      ...(args.hargaMinimal && { minPrice: Math.round(Number(args.hargaMinimal)) }),
      ...(args.kataKunci && { q: String(args.kataKunci).slice(0, 60) }),
    }
    return (await this.products.listPublic(query)).data
  }

  // ---------- mode cadangan (FAQ) ----------

  private async fallbackReply(text: string, faqs: PublicFaqDto[]): Promise<ChatReplyDto> {
    const suggestions = faqs.slice(0, 6).map((f) => f.question)
    const brands = (await this.prisma.brand.findMany({ select: { name: true } })).map((b) => b.name)
    const q = parseQuery(text, brands)
    if (hasProductIntent(q)) {
      const products = await this.search({
        merek: q.brands[0],
        ukuranEu: q.sizes[0],
        hargaMaksimal: q.maxPrice,
        hargaMinimal: q.minPrice,
      })
      return {
        reply: products.length
          ? `Ini sepatu tersedia yang cocok (${products.length}). Klik kartunya untuk lihat foto dan detail.`
          : 'Belum ada yang cocok, coba ukuran atau budget lain.',
        products,
        mode: 'faq',
        suggestions,
      }
    }
    const faq = bestFaq(text, faqs)
    return {
      reply:
        faq?.answer ??
        'Asisten AI sedang tidak tersedia. Pilih pertanyaan di bawah, atau tulis merek, ukuran, dan budget sepatu yang dicari.',
      products: [],
      mode: 'faq',
      suggestions,
    }
  }
}

function systemPrompt(store: OfficialChannelsDto | null, faqs: PublicFaqDto[]): string {
  const info = store
    ? [
        `Alamat toko: ${store.address}`,
        `Jam buka: ${store.openingHours.map((h) => `${h.days} ${h.hours}`).join('; ') || '-'}`,
        `WhatsApp resmi: ${store.whatsapp}`,
        `Batas waktu bayar setelah checkout: ${store.paymentDeadlineHours} jam`,
        `Cara ambil: ${store.fulfillmentMethods.map((m) => FULFILLMENT_LABELS[m]).join(', ')}`,
      ].join('\n')
    : 'Info toko belum diisi owner.'
  return `Kamu asisten belanja toko sepatu bekas bermerek "Suwandi SecondBranded" di Medan. Setiap sepatu hanya ada 1 unit.
Jawab dalam Bahasa Indonesia santai tapi sopan, singkat (maksimal 4 kalimat), teks biasa tanpa format markdown (tanpa ** atau daftar berbintang).

Aturan:
- Hanya bahas toko ini: stok sepatu, ukuran, kondisi, harga, cara belanja, pembayaran, pengiriman/ambil di toko, jam buka.
  Pertanyaan di luar itu: tolak dengan sopan dan katakan kamu hanya melayani seputar toko.
- Untuk stok, merek, ukuran, harga, atau rekomendasi: WAJIB panggil tool cari_sepatu. Jangan pernah mengarang sepatu, harga, atau stok.
  Bila hasilnya kosong, katakan "Belum ada yang cocok, coba ukuran/budget lain."
  Sepatu dari hasil pencarian ditampilkan sebagai kartu di bawah jawabanmu, jadi cukup ringkas (mis. sebut merek dan harga).
- Jangan menyebut nomor rekening. Untuk rekening resmi, arahkan ke halaman Kanal Resmi atau instruksi bayar di pesanan.
- Jangan menjanjikan diskon, tukar ukuran, atau hal lain yang tidak ada di info dan FAQ.

Info toko:
${info}

FAQ:
${faqs.map((f) => `- T: ${f.question}\n  J: ${f.answer}`).join('\n') || '-'}`
}
