<script setup lang="ts">
import { computed, ref } from 'vue'
import { MagnifyingGlassPlusIcon, PhotoIcon } from '@heroicons/vue/24/outline'
import type { ProductPhotoDto } from '@ssb/shared'

// Desktop: thumbnail vertikal + foto besar (layar Produk). Ponsel: geser foto + titik (M-Produk).
// "Perbesar" membuka Dialog layar penuh; klik foto di dialog untuk zoom 2x di titik yang diklik.
const props = defineProps<{ photos: ProductPhotoDto[]; name: string; dimmed?: boolean }>()

const index = ref(0)
const current = computed(() => props.photos[index.value])
const alt = (i: number) => `${props.name}, foto ${i + 1} dari ${props.photos.length}`

// Ponsel: sinkronkan titik dengan posisi geser
const strip = ref<HTMLElement>()
const onScroll = () => {
  const el = strip.value
  if (el) index.value = Math.round(el.scrollLeft / el.clientWidth)
}
const goTo = (i: number) => {
  index.value = i
  strip.value?.scrollTo({ left: i * strip.value.clientWidth, behavior: 'smooth' })
}

const zoomOpen = ref(false)
const zoomed = ref(false)
const origin = ref('50% 50%')
function toggleZoom(e: MouseEvent) {
  const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
  origin.value = `${((e.clientX - box.left) / box.width) * 100}% ${((e.clientY - box.top) / box.height) * 100}%`
  zoomed.value = !zoomed.value
}
const openZoom = () => {
  zoomed.value = false
  zoomOpen.value = true
}
</script>

<template>
  <section aria-label="Galeri foto" class="min-w-0">
    <div
      v-if="!photos.length"
      role="img"
      :aria-label="`Foto ${name} belum ada`"
      class="flex aspect-square flex-col items-center justify-center gap-2.5 rounded-card bg-photo text-brand-700"
    >
      <PhotoIcon class="size-10" aria-hidden="true" />Foto belum tersedia
    </div>

    <template v-else>
      <!-- Desktop -->
      <div class="hidden gap-3.5 lg:flex">
        <div
          role="tablist"
          aria-label="Pilih foto"
          aria-orientation="vertical"
          class="flex w-[76px] shrink-0 flex-col gap-2.5"
        >
          <button
            v-for="(p, i) in photos"
            :key="p.id"
            type="button"
            role="tab"
            :aria-selected="i === index"
            :aria-label="`Foto ${i + 1}`"
            class="size-[76px] overflow-hidden rounded-control border-2 bg-photo"
            :class="i === index ? 'border-brand-600' : 'border-transparent'"
            @click="index = i"
          >
            <img :src="p.url" alt="" class="size-full object-cover" />
          </button>
        </div>
        <div class="relative min-w-0 flex-1">
          <img
            :src="current?.url"
            :alt="alt(index)"
            class="aspect-square w-full rounded-card bg-photo object-cover"
            :class="dimmed && 'opacity-80'"
          />
          <button
            type="button"
            class="absolute right-4 bottom-4 flex h-11 cursor-zoom-in items-center gap-2 rounded-control bg-white/92 px-3.5 text-[13px] font-bold shadow-[0_4px_16px_rgb(47_75_65/0.12)]"
            @click="openZoom"
          >
            <MagnifyingGlassPlusIcon class="size-5" aria-hidden="true" />Perbesar
          </button>
        </div>
      </div>

      <!-- Ponsel -->
      <div class="lg:hidden">
        <div
          ref="strip"
          class="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
          aria-label="Galeri foto, geser untuk foto lain"
          @scroll.passive="onScroll"
        >
          <button
            v-for="(p, i) in photos"
            :key="p.id"
            type="button"
            class="w-full shrink-0 snap-start"
            :aria-label="`Perbesar ${alt(i)}`"
            @click="openZoom"
          >
            <img
              :src="p.url"
              :alt="alt(i)"
              class="aspect-square w-full bg-photo object-cover"
              :class="dimmed && 'opacity-80'"
            />
          </button>
        </div>
        <div role="tablist" aria-label="Pilih foto" class="flex justify-center gap-1 py-2">
          <button
            v-for="(p, i) in photos"
            :key="p.id"
            type="button"
            role="tab"
            :aria-selected="i === index"
            :aria-label="`Foto ${i + 1}`"
            class="flex size-7 items-center justify-center"
            @click="goTo(i)"
          >
            <span
              class="h-2 rounded-full transition-all"
              :class="i === index ? 'w-5 bg-brand-600' : 'w-2 bg-gray-300'"
            />
          </button>
        </div>
      </div>
    </template>

    <Dialog
      v-model:visible="zoomOpen"
      modal
      dismissable-mask
      :header="name"
      class="w-[min(96vw,960px)]"
      :pt="{ content: { class: 'overflow-hidden p-0' } }"
    >
      <button
        type="button"
        class="block w-full overflow-hidden"
        :class="zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'"
        :aria-label="zoomed ? 'Perkecil foto' : 'Perbesar 2x di titik ini'"
        @click="toggleZoom"
      >
        <img
          :src="current?.url"
          :alt="alt(index)"
          class="max-h-[80vh] w-full object-contain transition-transform duration-200"
          :style="{ transform: zoomed ? 'scale(2)' : 'none', transformOrigin: origin }"
        />
      </button>
    </Dialog>
  </section>
</template>
