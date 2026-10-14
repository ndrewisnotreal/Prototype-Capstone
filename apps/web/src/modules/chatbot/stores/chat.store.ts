import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { ProductCardDto, PublicFaqDto } from '@ssb/shared'
import { ApiRequestError } from '@/shared/lib'
import { chatApi } from '../api/chat.api'

export interface ChatEntry {
  role: 'user' | 'assistant'
  text: string
  products?: ProductCardDto[]
}

/** Riwayat yang dikirim ke API (batas server 10 pesan); sapaan pembuka tidak ikut */
const HISTORY = 10
export const WELCOME =
  'Halo! Aku bisa bantu cari sepatu, cek ukuran, atau jelaskan cara bayar. Mau mulai dari mana?'
export const AI_CHIPS = [
  'Rekomendasi sepatu',
  'Cari ukuran 42',
  'Cara bayar',
  'Rekening resmi',
  'Lokasi dan jam buka',
]

// Chat asisten (layar Chatbot/M-Chat). Satu riwayat per muat halaman, dibagi semua tombol "Tanya Asisten".
export const useChatStore = defineStore('chat', () => {
  const isOpen = ref(false)
  const messages = ref<ChatEntry[]>([])
  const sending = ref(false)
  /** diketahui dari jawaban server; 'faq' = AI tidak tersedia */
  const mode = ref<'ai' | 'faq'>('ai')
  const faqs = shallowRef<PublicFaqDto[]>([])

  const chips = computed(() =>
    mode.value === 'faq' ? faqs.value.map((f) => f.question) : AI_CHIPS,
  )

  function open() {
    isOpen.value = true
    if (!faqs.value.length)
      void chatApi
        .faqs()
        .then((list) => (faqs.value = list))
        .catch(() => {})
  }
  const close = () => (isOpen.value = false)

  async function send(text: string) {
    const question = text.trim().slice(0, 500)
    if (!question || sending.value) return
    messages.value.push({ role: 'user', text: question })
    sending.value = true
    try {
      const history = messages.value.slice(-HISTORY).map(({ role, text }) => ({ role, text }))
      const res = await chatApi.send(history)
      mode.value = res.mode
      messages.value.push({ role: 'assistant', text: res.reply, products: res.products })
    } catch (e) {
      messages.value.push({
        role: 'assistant',
        text:
          e instanceof ApiRequestError && e.status === 429
            ? e.message
            : 'Maaf, pesan belum terkirim. Cek koneksi lalu coba lagi.',
      })
    } finally {
      sending.value = false
    }
  }

  /** Mode FAQ: chip langsung dijawab dari FAQ tanpa memanggil AI */
  function pickChip(label: string) {
    const faq = mode.value === 'faq' ? faqs.value.find((f) => f.question === label) : undefined
    if (!faq) return send(label)
    messages.value.push(
      { role: 'user', text: faq.question },
      { role: 'assistant', text: faq.answer },
    )
  }

  return { isOpen, messages, sending, mode, chips, open, close, send, pickChip }
})
