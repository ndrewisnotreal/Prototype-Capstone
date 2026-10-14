<script setup lang="ts">
import { CheckIcon } from '@heroicons/vue/24/outline'
import { formatShortTime, type StepState, type TimelineStep } from '../order-timeline'

// Timeline status pesanan (PesananDetail): selesai ✓, sekarang (cincin), nanti (abu), masalah (!).
defineProps<{ steps: TimelineStep[] }>()

const DOT: Record<StepState, string> = {
  done: 'border-brand-600 bg-brand-600 text-white',
  current: 'border-brand-600 bg-white text-brand-700',
  todo: 'border-gray-300 bg-white text-gray-600',
  problem: 'border-danger-600 bg-danger-bg text-danger-fg',
}
const TEXT: Record<StepState, string> = {
  done: 'font-bold text-gray-900',
  current: 'font-extrabold text-gray-900',
  todo: 'font-medium text-gray-600',
  problem: 'font-extrabold text-danger-fg',
}
const STATE_LABEL: Record<StepState, string> = {
  done: 'selesai',
  current: 'sekarang',
  todo: 'belum',
  problem: 'bermasalah',
}
</script>

<template>
  <ol class="flex flex-col">
    <li v-for="(s, i) in steps" :key="i" class="flex gap-3.5">
      <span class="flex flex-none flex-col items-center">
        <span
          class="flex size-6 items-center justify-center rounded-full border-2 text-xs font-extrabold lg:size-7"
          :class="DOT[s.state]"
        >
          <CheckIcon v-if="s.state === 'done'" class="size-3.5 stroke-[3]" aria-hidden="true" />
          <template v-else-if="s.state === 'problem'">!</template>
          <template v-else-if="s.state === 'todo'">{{ i + 1 }}</template>
        </span>
        <span
          v-if="i < steps.length - 1"
          class="min-h-6 w-0.5 flex-1"
          :class="s.state === 'done' ? 'bg-brand-600' : 'bg-gray-200'"
        ></span>
      </span>
      <span class="flex flex-col gap-0.5 pb-4.5">
        <span class="text-[15px]" :class="TEXT[s.state]"
          >{{ s.label }}<span class="sr-only"> ({{ STATE_LABEL[s.state] }})</span></span
        >
        <span v-if="s.at || s.note" class="text-[13px] text-gray-600">{{
          [s.at && formatShortTime(s.at), s.note].filter(Boolean).join(', ')
        }}</span>
      </span>
    </li>
  </ol>
</template>
