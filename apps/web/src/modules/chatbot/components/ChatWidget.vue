<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import {
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'
import { useChatStore, WELCOME } from '../stores/chat.store'
import ChatProductCard from './ChatProductCard.vue'

// Layar Chatbot (panel kanan bawah, desktop) dan M-Chat (layar penuh, ponsel). Dipasang sekali di StorefrontLayout.
const chat = useChatStore()
const draft = ref('')
const input = ref<HTMLInputElement>()
const log = ref<HTMLElement>()

function submit() {
  const text = draft.value
  draft.value = ''
  void chat.send(text)
}
// pesan baru atau indikator mengetik: gulir ke bawah
watch(
  () => [chat.messages.length, chat.sending],
  async () => {
    await nextTick()
    if (log.value) log.value.scrollTop = log.value.scrollHeight
  },
)
watch(
  () => chat.isOpen,
  async (open) => {
    if (!open) return
    await nextTick()
    input.value?.focus()
  },
)
// tutup panel saat pindah ke halaman sepatu di ponsel (layar penuh menutupi halaman)
const closeOnMobile = () => window.matchMedia('(max-width: 1023px)').matches && chat.close()
</script>

<template>
  <section
    v-if="chat.isOpen"
    role="dialog"
    aria-labelledby="chat-h"
    class="fixed inset-0 z-50 flex flex-col overflow-hidden bg-white lg:inset-auto lg:right-6 lg:bottom-6 lg:h-[min(680px,calc(100vh-100px))] lg:w-[400px] lg:rounded-card lg:border lg:border-gray-200 lg:shadow-[0_24px_48px_rgb(24_39_31/0.22)]"
    @keydown.esc="chat.close()"
  >
    <header
      class="flex h-16 flex-none items-center gap-3 bg-brand-700 pr-2 pl-4 text-white lg:h-auto lg:py-3.5"
    >
      <span
        class="flex size-10 flex-none items-center justify-center rounded-control bg-accent-400/20 text-accent-400"
        ><SparklesIcon class="size-5.5" aria-hidden="true"
      /></span>
      <span class="flex flex-1 flex-col">
        <span id="chat-h" class="text-[15px] font-extrabold">Asisten Suwandi</span>
        <span class="text-xs text-brand-100">{{
          chat.mode === 'faq' ? 'Mode FAQ' : 'Asisten AI toko'
        }}</span>
      </span>
      <button
        type="button"
        aria-label="Tutup chat"
        class="flex size-11 items-center justify-center rounded-control hover:bg-white/10"
        @click="chat.close()"
      >
        <XMarkIcon class="size-6" aria-hidden="true" />
      </button>
    </header>

    <div
      v-if="chat.mode === 'faq'"
      role="status"
      class="flex items-center gap-2 bg-warning-bg px-4 py-2.5 text-[13px] font-semibold text-warning-fg"
    >
      <ExclamationTriangleIcon class="size-4.5 flex-none" aria-hidden="true" />Asisten AI sedang
      tidak tersedia. Pilih pertanyaan umum, atau tulis merek, ukuran, dan budget.
    </div>

    <div
      ref="log"
      role="log"
      aria-live="polite"
      class="flex flex-1 flex-col gap-2.5 overflow-y-auto bg-gray-50 p-4"
    >
      <div
        class="max-w-[85%] self-start rounded-[16px_16px_16px_4px] border border-gray-200 bg-white px-3.5 py-2.5 text-sm/normal"
      >
        {{ WELCOME }}
      </div>
      <template v-for="(m, i) in chat.messages" :key="i">
        <div
          v-if="m.role === 'user'"
          class="max-w-[80%] self-end rounded-[16px_16px_4px_16px] bg-brand-600 px-3.5 py-2.5 text-sm/normal text-white"
        >
          {{ m.text }}
        </div>
        <template v-else>
          <div
            class="max-w-[85%] self-start rounded-[16px_16px_16px_4px] border border-gray-200 bg-white px-3.5 py-2.5 text-sm/normal whitespace-pre-line"
          >
            {{ m.text }}
          </div>
          <ChatProductCard
            v-for="p in m.products ?? []"
            :key="p.code"
            :product="p"
            @open="closeOnMobile"
          />
        </template>
      </template>
      <div
        v-if="chat.sending"
        aria-label="Asisten sedang mengetik"
        role="status"
        class="inline-flex gap-1.5 self-start rounded-card border border-gray-200 bg-white px-3.5 py-3"
      >
        <span
          v-for="d in [0, 150, 300]"
          :key="d"
          class="size-1.75 animate-bounce rounded-full bg-gray-600"
          :style="{ animationDelay: `${d}ms` }"
        ></span>
      </div>
    </div>

    <div class="flex-none border-t border-gray-200 bg-white">
      <div class="flex gap-1.5 overflow-x-auto px-3 pt-2.5 [scrollbar-width:none]">
        <button
          v-for="c in chat.chips"
          :key="c"
          type="button"
          class="h-10 flex-none rounded-full border border-brand-200 bg-brand-50 px-3 text-[13px] font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-50 lg:h-9 lg:text-xs"
          :disabled="chat.sending"
          @click="chat.pickChip(c)"
        >
          {{ c }}
        </button>
      </div>
      <form class="flex gap-2 px-3 pt-2.5 pb-1.5" @submit.prevent="submit">
        <label class="flex flex-1">
          <span class="sr-only">Tulis pertanyaan</span>
          <input
            ref="input"
            v-model="draft"
            type="text"
            maxlength="500"
            placeholder="Tanya soal sepatu atau pesanan"
            class="h-12 min-w-0 flex-1 rounded-control border border-gray-300 px-3.5 text-base outline-none focus:border-brand-600 lg:h-11 lg:text-sm"
          />
        </label>
        <button
          type="submit"
          aria-label="Kirim"
          class="flex size-12 flex-none items-center justify-center rounded-control bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 lg:size-11"
          :disabled="!draft.trim() || chat.sending"
        >
          <PaperAirplaneIcon class="size-5" aria-hidden="true" />
        </button>
      </form>
      <p class="px-3.5 pb-[max(12px,env(safe-area-inset-bottom))] text-[11px] text-gray-600">
        Asisten AI, jawaban bisa keliru. Cek detail produk sebelum membeli.
      </p>
    </div>
  </section>
</template>
