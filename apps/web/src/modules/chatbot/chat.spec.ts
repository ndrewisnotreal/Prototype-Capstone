import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatReplyDto, ProductCardDto } from '@ssb/shared'
import { ApiRequestError } from '@/shared/lib'
import { chatApi } from './api/chat.api'
import ChatWidget from './components/ChatWidget.vue'
import { AI_CHIPS, useChatStore } from './stores/chat.store'

vi.mock('./api/chat.api', () => ({ chatApi: { send: vi.fn(), faqs: vi.fn() } }))

const product: ProductCardDto = {
  code: 'SSB-0007',
  brand: 'Nike',
  model: 'Air Force 1 Low',
  sizeEu: 42,
  condition: 'GOOD',
  price: 350000,
  status: 'AVAILABLE',
  primaryPhotoUrl: null,
  isNew: false,
}
const reply = (over: Partial<ChatReplyDto> = {}): ChatReplyDto => ({
  reply: 'Ada 1 yang cocok.',
  products: [],
  mode: 'ai',
  suggestions: [],
  ...over,
})

describe('chat store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(chatApi.faqs).mockResolvedValue([
      { id: 1, question: 'Bagaimana cara bayar?', answer: 'Transfer ke rekening resmi.' },
    ])
  })

  it('mengirim riwayat (tanpa sapaan) dan menyimpan jawaban + kartu', async () => {
    const chat = useChatStore()
    vi.mocked(chatApi.send).mockResolvedValue(reply({ products: [product] }))
    await chat.send('  ada nike 42?  ')
    await chat.send('yang lebih murah?')
    expect(vi.mocked(chatApi.send).mock.calls[1]![0]).toEqual([
      { role: 'user', text: 'ada nike 42?' },
      { role: 'assistant', text: 'Ada 1 yang cocok.' },
      { role: 'user', text: 'yang lebih murah?' },
    ])
    expect(chat.messages[1]!.products).toEqual([product])
    expect(chat.chips).toEqual(AI_CHIPS)
  })

  it('mode FAQ: chip berganti FAQ dan dijawab tanpa memanggil AI', async () => {
    const chat = useChatStore()
    chat.open()
    vi.mocked(chatApi.send).mockResolvedValue(reply({ mode: 'faq', reply: 'Pilih pertanyaan.' }))
    await chat.send('halo')
    await flushPromises()
    expect(chat.chips).toEqual(['Bagaimana cara bayar?'])
    chat.pickChip('Bagaimana cara bayar?')
    expect(chatApi.send).toHaveBeenCalledTimes(1)
    expect(chat.messages.at(-1)).toEqual({ role: 'assistant', text: 'Transfer ke rekening resmi.' })
  })

  it('batas pesan (429) dan gangguan jaringan jadi pesan asisten', async () => {
    const chat = useChatStore()
    vi.mocked(chatApi.send).mockRejectedValueOnce(
      new ApiRequestError(429, 'RATE_LIMITED', 'Terlalu banyak pertanyaan.'),
    )
    await chat.send('halo')
    expect(chat.messages.at(-1)!.text).toBe('Terlalu banyak pertanyaan.')
    vi.mocked(chatApi.send).mockRejectedValueOnce(new Error('offline'))
    await chat.send('halo lagi')
    expect(chat.messages.at(-1)!.text).toContain('belum terkirim')
    expect(chat.sending).toBe(false)
  })
})

describe('ChatWidget', () => {
  it('kirim dari form, kartu produk menuju halaman sepatu, label peringatan tampil', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    vi.mocked(chatApi.faqs).mockResolvedValue([])
    vi.mocked(chatApi.send).mockResolvedValue(reply({ products: [product] }))
    const chat = useChatStore()
    chat.open()
    const w = mount(ChatWidget, {
      global: { plugins: [pinia], stubs: { RouterLink: RouterLinkStub } },
    })
    await flushPromises()
    expect(w.text()).toContain('jawaban bisa keliru')
    await w.get('input').setValue('ada nike 42?')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.findComponent(RouterLinkStub).props('to')).toBe('/sepatu/SSB-0007')
    await w.get('button[aria-label="Tutup chat"]').trigger('click')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })
})
