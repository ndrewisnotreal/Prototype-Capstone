<script setup lang="ts" generic="T extends object">
import { computed } from 'vue'
import { isOffline } from '@/shared/lib'
import { ChevronLeftIcon, ChevronRightIcon, InboxIcon } from '@heroicons/vue/24/outline'
import AppButton from './AppButton.vue'
import EmptyState from './EmptyState.vue'
import OfflineState from './OfflineState.vue'

// Tabel panel (ADR-0004): DataTable PrimeVue + paginasi server + 3 state (skeleton, kosong, error).
// Kolom ditulis sebagai <Column> di slot default, sama seperti DataTable biasa.
const props = withDefaults(
  defineProps<{
    rows: T[]
    total: number
    page: number
    limit: number
    loading?: boolean
    error?: string
    /** kata benda untuk teks "Menampilkan 1-12 dari 40 sepatu" */
    noun?: string
    emptyTitle?: string
    emptyText?: string
    sortField?: string
    sortOrder?: 1 | -1 | 0
    dataKey?: string
  }>(),
  { noun: 'data', emptyTitle: 'Belum ada data', dataKey: 'id', sortOrder: 0 },
)
const emit = defineEmits<{
  'update:page': [page: number]
  sort: [field: string | undefined, order: 1 | -1 | 0]
  retry: []
}>()

const from = computed(() => (props.total ? (props.page - 1) * props.limit + 1 : 0))
const to = computed(() => Math.min(props.page * props.limit, props.total))
const lastPage = computed(() => Math.max(1, Math.ceil(props.total / props.limit)))

function onSort(e: { sortField?: unknown; sortOrder?: number | null }) {
  emit(
    'sort',
    typeof e.sortField === 'string' ? e.sortField : undefined,
    (e.sortOrder ?? 0) as 1 | -1 | 0,
  )
}
</script>

<template>
  <section class="overflow-hidden rounded-card border border-gray-200 bg-white">
    <div v-if="loading && !rows.length" class="flex flex-col gap-3 p-5" aria-busy="true">
      <div v-for="i in 6" :key="i" class="flex items-center gap-3">
        <Skeleton size="48px" border-radius="10px" />
        <div class="flex flex-1 flex-col gap-2">
          <Skeleton width="30%" height="12px" />
          <Skeleton width="60%" height="14px" />
        </div>
        <Skeleton width="80px" height="24px" border-radius="999px" />
      </div>
    </div>

    <div v-else-if="error && isOffline" class="px-6">
      <OfflineState auto-retry @retry="emit('retry')" />
    </div>

    <div
      v-else-if="error"
      role="alert"
      class="flex flex-col items-center gap-3 px-6 py-12 text-center"
    >
      <p class="text-lg font-extrabold">Data belum bisa dimuat</p>
      <p class="text-sm text-gray-600">{{ error }}</p>
      <AppButton label="Coba lagi" @click="emit('retry')" />
    </div>

    <div v-else-if="!rows.length" class="p-5">
      <slot name="empty">
        <EmptyState :title="emptyTitle" :description="emptyText" :icon="InboxIcon" />
      </slot>
    </div>

    <template v-else>
      <DataTable
        :value="rows"
        :data-key="dataKey"
        lazy
        :sort-field="sortField"
        :sort-order="sortOrder"
        removable-sort
        scrollable
        table-class="min-w-[900px] text-sm"
        :class="loading && 'opacity-60'"
        :pt="{ thead: { class: 'text-xs' } }"
        @sort="onSort"
      >
        <slot />
      </DataTable>
      <div
        class="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 text-[13px] text-gray-600"
      >
        <span>Menampilkan {{ from }}-{{ to }} dari {{ total }} {{ noun }}</span>
        <span class="flex gap-1.5">
          <AppButton
            variant="secondary"
            size="sm"
            :icon="ChevronLeftIcon"
            aria-label="Halaman sebelumnya"
            :disabled="page <= 1 || loading"
            class="w-9 px-0!"
            @click="emit('update:page', page - 1)"
          />
          <AppButton
            variant="secondary"
            size="sm"
            :icon="ChevronRightIcon"
            aria-label="Halaman berikutnya"
            :disabled="page >= lastPage || loading"
            class="w-9 px-0!"
            @click="emit('update:page', page + 1)"
          />
        </span>
      </div>
    </template>
  </section>
</template>
