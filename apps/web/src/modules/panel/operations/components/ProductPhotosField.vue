<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import { ArrowLeftIcon, ArrowRightIcon, CameraIcon, XMarkIcon } from '@heroicons/vue/24/outline'

// Kotak foto form produk (layar P-ProdukForm): 3-6 foto, klik = jadikan utama, ← → = ubah urutan, × = hapus.
// Komponen ini hanya mengatur tampilan; halaman yang memutuskan perubahan dikirim ke API (edit) atau ditahan (tambah).
export interface PhotoItem {
  key: string | number
  url: string
  isPrimary: boolean
}
const props = defineProps<{ photos: PhotoItem[]; busy?: boolean; error?: string }>()
const emit = defineEmits<{
  add: [files: File[]]
  remove: [index: number]
  move: [from: number, to: number]
  primary: [index: number]
}>()

const MAX = 6
const SLOT_HINTS = ['Samping luar', 'Samping dalam', 'Depan', 'Sol bawah', 'Foto minus', 'Insole']
const emptySlots = computed(() => SLOT_HINTS.slice(props.photos.length))

function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = [...(input.files ?? [])].slice(0, MAX - props.photos.length)
  input.value = '' // pilih file yang sama lagi tetap memicu change
  if (files.length) emit('add', files)
}

// URL blob dari pratinjau lokal dilepas saat komponen hilang
onBeforeUnmount(() =>
  props.photos.forEach((p) => p.url.startsWith('blob:') && URL.revokeObjectURL(p.url)),
)
</script>

<template>
  <fieldset
    class="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-5"
    :aria-busy="busy"
  >
    <legend class="float-left text-[17px] font-extrabold">
      Foto
      <span class="text-[13px] font-medium text-gray-600"
        >{{ photos.length }} dari 6 · minimal 3, latar terang</span
      >
    </legend>
    <div class="clear-both grid grid-cols-3 gap-2.5 sm:grid-cols-6">
      <div v-for="(p, i) in photos" :key="p.key" class="flex flex-col gap-1">
        <button
          type="button"
          :aria-label="`Jadikan foto utama: foto ${i + 1}`"
          :aria-pressed="p.isPrimary"
          :disabled="busy"
          class="relative aspect-square overflow-hidden rounded-control border-2 bg-photo"
          :class="p.isPrimary ? 'border-brand-600' : 'border-transparent'"
          @click="emit('primary', i)"
        >
          <img :src="p.url" :alt="`Foto ${i + 1}`" class="size-full object-cover" />
          <span
            v-if="p.isPrimary"
            class="absolute top-1.5 left-1.5 rounded-full bg-accent-400 px-[7px] py-0.5 text-[10px] font-extrabold text-gray-900"
            >Utama</span
          >
        </button>
        <span class="flex justify-between">
          <button
            type="button"
            :aria-label="`Geser foto ${i + 1} ke kiri`"
            :disabled="busy || i === 0"
            class="flex size-8 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-30"
            @click="emit('move', i, i - 1)"
          >
            <ArrowLeftIcon class="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            :aria-label="`Hapus foto ${i + 1}`"
            :disabled="busy"
            class="flex size-8 items-center justify-center rounded-lg text-danger-fg hover:bg-danger-bg disabled:opacity-30"
            @click="emit('remove', i)"
          >
            <XMarkIcon class="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            :aria-label="`Geser foto ${i + 1} ke kanan`"
            :disabled="busy || i === photos.length - 1"
            class="flex size-8 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-30"
            @click="emit('move', i, i + 1)"
          >
            <ArrowRightIcon class="size-4" aria-hidden="true" />
          </button>
        </span>
      </div>
      <label
        v-for="(hint, i) in emptySlots"
        :key="hint"
        class="relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-control border-2 border-dashed border-brand-200 bg-[#F7FAF8] p-1 text-center text-[11px] font-bold text-brand-700 focus-within:border-brand-600"
        :class="i > 0 && 'hidden sm:flex'"
      >
        <CameraIcon class="size-6" aria-hidden="true" />{{ hint }}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          class="sr-only"
          :disabled="busy"
          @change="onFiles"
        />
      </label>
    </div>
    <p v-if="error" class="text-xs font-semibold text-danger-fg" role="alert">{{ error }}</p>
    <p class="text-xs text-gray-600">
      Klik foto untuk menjadikannya foto utama. Pakai panah untuk mengubah urutan. Foto minus wajib
      kalau ada cacat. JPG, PNG, atau WebP, maks 5 MB.
    </p>
  </fieldset>
</template>
