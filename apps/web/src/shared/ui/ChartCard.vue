<script setup lang="ts">
// Kartu grafik (ADR-0004): judul + keterangan + slot aksi (mis. tab periode) + isi grafik di slot default.
defineProps<{ title: string; subtitle?: string; headingId: string }>()
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="flex flex-col gap-4 rounded-card border border-gray-200 bg-white p-5"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 :id="headingId" class="text-[17px] font-extrabold">{{ title }}</h2>
        <p v-if="subtitle" class="text-[13px] text-gray-600">{{ subtitle }}</p>
      </div>
      <slot name="actions" />
    </div>
    <slot />
  </section>
</template>
