<script setup lang="ts">
// Tanda "S" hijau dengan titik kuning. inverted = kotak putih (di atas latar hijau, layar Auth).
withDefaults(defineProps<{ size?: 'sm' | 'md'; inverted?: boolean }>(), { size: 'md' })
</script>

<template>
  <span
    aria-hidden="true"
    class="relative flex shrink-0 items-center justify-center font-extrabold tracking-tight"
    :class="[
      size === 'sm' ? 'size-[34px] rounded-[10px] text-base' : 'size-10 rounded-control text-lg',
      inverted ? 'bg-white text-brand-700' : 'bg-brand-600 text-white',
    ]"
  >
    S
    <span
      class="absolute rounded-[2px] bg-accent-400"
      :class="
        size === 'sm' ? 'right-[5px] bottom-[5px] size-1.5' : 'right-1.5 bottom-1.5 size-[7px]'
      "
    />
  </span>
</template>
