<script setup lang="ts">
import { ref } from 'vue'
import { ArrowUpTrayIcon } from '@heroicons/vue/24/outline'

// Dropzone (DS-Components): tarik file ke sini atau klik untuk memilih. Validasi tipe/ukuran oleh pemakai.
withDefaults(defineProps<{ title: string; hint?: string; accept?: string; disabled?: boolean }>(), {
  accept: undefined,
  hint: undefined,
})
const emit = defineEmits<{ select: [file: File] }>()

const over = ref(false)
function onChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // memilih file yang sama lagi tetap memicu change
  if (file) emit('select', file)
}
function onDrop(e: DragEvent) {
  over.value = false
  const file = e.dataTransfer?.files[0]
  if (file) emit('select', file)
}
</script>

<template>
  <label
    class="flex cursor-pointer flex-col items-center gap-2.5 rounded-card border-2 border-dashed px-6 py-11 text-center transition-colors focus-within:border-brand-600"
    :class="over ? 'border-brand-600 bg-brand-50' : 'border-brand-200 bg-brand-50/50'"
    @dragover.prevent="over = true"
    @dragleave="over = false"
    @drop.prevent="onDrop"
  >
    <ArrowUpTrayIcon class="size-9 text-brand-600" aria-hidden="true" />
    <span class="text-[17px] font-extrabold">{{ title }}</span>
    <span v-if="hint" class="text-sm text-gray-600">{{ hint }}</span>
    <input type="file" class="sr-only" :accept="accept" :disabled="disabled" @change="onChange" />
  </label>
</template>
