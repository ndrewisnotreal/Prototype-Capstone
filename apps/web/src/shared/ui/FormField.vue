<script setup lang="ts">
import { computed, useId } from 'vue'
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline'

// Label di atas, hint, dan pesan error di bawah input. Input di slot menerima id dan aria lewat slot props:
// <FormField label="Email" :error="e" v-slot="field"><InputText v-bind="field.input" fluid /></FormField>
// Password/Select/InputNumber menaruh id di elemen pembungkus: tambahkan :input-id="field.id".
const props = defineProps<{ label: string; hint?: string; error?: string; required?: boolean }>()

const id = useId()
const messageId = `${id}-msg`
const input = computed(() => ({
  id,
  invalid: !!props.error,
  'aria-invalid': props.error ? true : undefined,
  'aria-describedby': props.error || props.hint ? messageId : undefined,
  'aria-required': props.required || undefined,
}))
</script>

<template>
  <div class="flex flex-col gap-2">
    <label :for="id" class="text-sm font-semibold text-gray-900">
      {{ label }}<span v-if="required" class="text-danger-fg" aria-hidden="true"> *</span>
    </label>
    <slot :id="id" :input="input" :invalid="!!error" />
    <p
      v-if="error"
      :id="messageId"
      class="flex items-center gap-1.5 text-xs font-semibold text-danger-fg"
      aria-live="polite"
    >
      <ExclamationTriangleIcon class="size-4 shrink-0" aria-hidden="true" />{{ error }}
    </p>
    <p v-else-if="hint" :id="messageId" class="text-xs text-gray-600">{{ hint }}</p>
  </div>
</template>
