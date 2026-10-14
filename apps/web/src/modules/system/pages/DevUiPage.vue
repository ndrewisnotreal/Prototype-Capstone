<script setup lang="ts">
import { ref } from 'vue'
import { ShoppingBagIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'
import {
  CONDITION_LABELS,
  Condition,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  ProofStatus,
} from '@ssb/shared'
import {
  AppButton,
  ConditionBadge,
  EmptyState,
  FilterChip,
  FormField,
  SearchBar,
  StatusBadge,
} from '@/shared/ui'
import { useConfirmAction, useNotify } from '@/shared/composables'

// Katalog komponen shared/ui untuk dicocokkan dengan layar DS-Components (hanya mode dev).
const variants = ['primary', 'accent', 'secondary', 'ghost', 'danger'] as const
const variantNames = {
  primary: 'Primer',
  accent: 'Aksen',
  secondary: 'Sekunder',
  ghost: 'Ghost',
  danger: 'Bahaya',
}

const form = ref({
  name: 'Rizky Siregar',
  phone: '0812 6',
  email: 'rizky@',
  password: '',
  condition: 'VERY_GOOD',
  defects: 'Creasing ringan di ujung kiri',
  hasBox: true,
  hasInsole: false,
  fulfillment: 'PICKUP',
  visible: true,
})
const conditionOptions = Object.values(Condition).map((value) => ({
  value,
  label: CONDITION_LABELS[value],
}))
const query = ref('')
const chips = ref<Record<string, boolean>>({ Nike: false, 'EU 42': true })

const notify = useNotify()
const confirm = useConfirmAction()
const lastConfirm = ref('')
async function askCancel() {
  const ok = await confirm({
    title: 'Batalkan pesanan?',
    message: 'Sepatu akan kembali tersedia untuk orang lain.',
    acceptLabel: 'Batalkan pesanan',
    danger: true,
  })
  lastConfirm.value = ok ? 'Dikonfirmasi' : 'Dibatalkan'
}
</script>

<template>
  <main class="mx-auto flex max-w-7xl flex-col gap-10 px-6 pt-12 pb-18">
    <header>
      <h1 class="text-4xl font-extrabold tracking-tight">Komponen dan state</h1>
      <p class="mt-1.5 max-w-[70ch] text-gray-600">
        Halaman dev untuk mencocokkan <code>shared/ui</code> dan preset PrimeVue dengan layar
        DS-Components.
      </p>
    </header>

    <section
      class="flex flex-col gap-4 rounded-card border border-gray-200 bg-white p-6"
      aria-labelledby="btn-h"
    >
      <h2 id="btn-h" class="text-[22px] font-extrabold">
        Tombol <code class="text-xs font-normal text-gray-600">AppButton</code>
      </h2>
      <div class="overflow-x-auto">
        <div
          class="grid min-w-[760px] grid-cols-[110px_repeat(4,minmax(130px,1fr))] items-center gap-x-3.5 gap-y-3"
        >
          <span></span>
          <span
            v-for="h in ['Default', 'Dengan ikon', 'Disabled', 'Loading']"
            :key="h"
            class="text-xs font-bold text-gray-600"
            >{{ h }}</span
          >
          <template v-for="v in variants" :key="v">
            <span class="text-[13px] font-bold">{{ variantNames[v] }}</span>
            <AppButton :variant="v" :label="variantNames[v]" :data-test="`btn-${v}`" />
            <AppButton :variant="v" :label="variantNames[v]" :icon="ArrowPathIcon" />
            <AppButton :variant="v" :label="variantNames[v]" disabled />
            <AppButton :variant="v" label="Memproses" loading />
          </template>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-1.5">
        <span class="w-[110px] text-[13px] font-bold">Ukuran</span>
        <AppButton size="sm" label="Kecil 36" data-test="btn-sm" />
        <AppButton size="md" label="Sedang 44" data-test="btn-md" />
        <AppButton size="lg" label="Besar 52" data-test="btn-lg" />
        <span class="text-[13px] text-gray-600">Di mobile minimal ukuran Sedang (44px).</span>
      </div>
    </section>

    <div class="flex flex-wrap items-start gap-5">
      <section
        class="flex min-w-0 flex-[999_1_560px] flex-col gap-4.5 rounded-card border border-gray-200 bg-white p-6"
        aria-labelledby="form-h"
      >
        <h2 id="form-h" class="text-[22px] font-extrabold">
          Form <code class="text-xs font-normal text-gray-600">FormField + PrimeVue</code>
        </h2>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4.5">
          <FormField v-slot="f" label="Nama lengkap" hint="Default">
            <InputText v-model="form.name" v-bind="f.input" fluid data-test="input-default" />
          </FormField>
          <FormField v-slot="f" label="No. WhatsApp" hint="Fokus (klik untuk melihat)">
            <InputText v-model="form.phone" v-bind="f.input" type="tel" fluid />
          </FormField>
          <FormField
            v-slot="f"
            label="Email"
            error="Format email belum benar, contoh: nama@gmail.com"
          >
            <InputText
              v-model="form.email"
              v-bind="f.input"
              type="email"
              fluid
              data-test="input-error"
            />
          </FormField>
          <FormField v-slot="f" label="Email akun" hint="Disabled">
            <InputText model-value="rizky@gmail.com" v-bind="f.input" disabled fluid />
          </FormField>
          <FormField v-slot="f" label="Password" required>
            <Password
              v-model="form.password"
              :input-id="f.id"
              :invalid="f.invalid"
              toggle-mask
              :feedback="false"
              fluid
            />
          </FormField>
          <FormField v-slot="f" label="Kondisi">
            <Select
              v-model="form.condition"
              :label-id="f.id"
              :options="conditionOptions"
              option-label="label"
              option-value="value"
              fluid
            />
          </FormField>
          <FormField v-slot="f" label="Catatan minus">
            <Textarea v-model="form.defects" v-bind="f.input" rows="2" auto-resize fluid />
          </FormField>
        </div>
        <div class="flex flex-wrap items-center gap-6 border-t border-gray-100 pt-3.5">
          <label class="flex min-h-11 items-center gap-2.5 text-sm"
            ><Checkbox v-model="form.hasBox" binary /> Box asli</label
          >
          <label class="flex min-h-11 items-center gap-2.5 text-sm"
            ><Checkbox v-model="form.hasInsole" binary /> Insole asli</label
          >
          <label class="flex min-h-11 items-center gap-2.5 text-sm"
            ><RadioButton v-model="form.fulfillment" value="PICKUP" /> Ambil di toko</label
          >
          <label class="flex min-h-11 items-center gap-2.5 text-sm"
            ><RadioButton v-model="form.fulfillment" value="SHIPPING" /> Dikirim</label
          >
          <label class="flex min-h-11 items-center gap-2.5 text-sm"
            ><ToggleSwitch v-model="form.visible" /> Tampilkan di katalog</label
          >
        </div>
        <SearchBar v-model="query" />
      </section>

      <section
        class="flex min-w-0 flex-[1_1_380px] flex-col gap-4 rounded-card border border-gray-200 bg-white p-6"
        aria-labelledby="badge-h"
      >
        <h2 id="badge-h" class="text-[22px] font-extrabold">
          Badge <code class="text-xs font-normal text-gray-600">StatusBadge, ConditionBadge</code>
        </h2>
        <div class="flex flex-col gap-2">
          <span class="text-[13px] font-bold text-gray-700">Status sepatu</span>
          <div class="flex flex-wrap gap-2">
            <StatusBadge
              v-for="s in Object.values(ProductStatus)"
              :key="s"
              type="product"
              :status="s"
            />
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <span class="text-[13px] font-bold text-gray-700">Status pesanan</span>
          <div class="flex flex-wrap gap-2">
            <StatusBadge
              v-for="s in Object.values(OrderStatus)"
              :key="s"
              type="order"
              :status="s"
            />
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <span class="text-[13px] font-bold text-gray-700">Status pembayaran</span>
          <div class="flex flex-wrap gap-2">
            <StatusBadge
              v-for="s in Object.values(PaymentStatus)"
              :key="s"
              type="payment"
              :status="s"
            />
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <span class="text-[13px] font-bold text-gray-700">Status bukti transfer</span>
          <div class="flex flex-wrap gap-2">
            <StatusBadge
              v-for="s in Object.values(ProofStatus)"
              :key="s"
              type="proof"
              :status="s"
            />
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <span class="text-[13px] font-bold text-gray-700">Kondisi</span>
          <div class="flex flex-wrap gap-2">
            <ConditionBadge v-for="c in Object.values(Condition)" :key="c" :condition="c" />
          </div>
        </div>
        <div class="flex flex-col gap-2 border-t border-gray-100 pt-3">
          <span class="text-[13px] font-bold text-gray-700"
            >Chip filter <code class="text-xs font-normal text-gray-600">FilterChip</code></span
          >
          <div class="flex flex-wrap gap-2">
            <FilterChip
              v-for="(on, label) in chips"
              :key="label"
              :label="label"
              :active="on"
              @click="chips[label] = !on"
            />
            <FilterChip label="EU 46 (kosong)" disabled />
          </div>
        </div>
      </section>
    </div>

    <div class="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] items-start gap-5">
      <section
        class="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-6"
        aria-labelledby="fb-h"
      >
        <h2 id="fb-h" class="text-[22px] font-extrabold">
          Toast dan modal
          <code class="text-xs font-normal text-gray-600">useNotify, useConfirmAction</code>
        </h2>
        <div class="flex flex-wrap gap-2.5">
          <AppButton
            variant="secondary"
            label="Toast sukses"
            @click="notify.success('Sepatu masuk keranjang.')"
          />
          <AppButton
            variant="secondary"
            label="Toast gagal"
            @click="notify.error('Maaf, sepatu ini baru saja dipesan orang lain.')"
          />
          <AppButton variant="danger" label="Batalkan pesanan" @click="askCancel" />
        </div>
        <p v-if="lastConfirm" class="text-sm text-gray-600" role="status">
          Hasil konfirmasi: {{ lastConfirm }}
        </p>
      </section>

      <section
        class="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-6"
        aria-labelledby="empty-h"
      >
        <h2 id="empty-h" class="text-[22px] font-extrabold">
          Empty state <code class="text-xs font-normal text-gray-600">EmptyState</code>
        </h2>
        <EmptyState
          title="Keranjang masih kosong"
          description="Sepatu cepat laku. Simpan yang kamu suka sebelum diambil orang."
          :icon="ShoppingBagIcon"
        >
          <AppButton label="Lihat Katalog" />
        </EmptyState>
      </section>
    </div>
  </main>
</template>
