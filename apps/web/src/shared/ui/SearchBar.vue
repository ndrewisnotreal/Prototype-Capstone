<script setup lang="ts">
import { useId } from 'vue'
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'

withDefaults(defineProps<{ placeholder?: string; label?: string }>(), {
  placeholder: 'Cari merek, model, ukuran',
  label: 'Cari',
})
const query = defineModel<string>({ default: '' })
const id = useId()
</script>

<template>
  <div>
    <label :for="id" class="sr-only">{{ label }}</label>
    <IconField>
      <InputIcon class="flex items-center">
        <MagnifyingGlassIcon class="size-5 text-gray-600" aria-hidden="true" />
      </InputIcon>
      <InputText
        :id="id"
        v-model="query"
        type="search"
        :placeholder="placeholder"
        class="h-12 border-gray-200 bg-gray-100 text-[15px]"
        fluid
      />
    </IconField>
  </div>
</template>
