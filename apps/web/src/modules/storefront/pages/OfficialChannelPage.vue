<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  ShieldExclamationIcon,
  XCircleIcon,
} from '@heroicons/vue/24/outline'
import { AppButton } from '@/shared/ui'
import { formatDate } from '@/shared/lib'
import { useStoreInfo } from '../store-info'
import { checkOfficialNumber, isRealPhone, mapsLink, whatsappLink } from '../official-channels'

// Layar KanalResmi. Semua rekening, WA, sosial, alamat, jam buka dari API (aturan "tanpa data karangan").
const { info, ready } = useStoreInfo()
const loadFailed = ref(false)
const track = (p: Promise<void>) => p.then(() => (loadFailed.value = !info.value))
void track(ready)
function retry() {
  loadFailed.value = false
  void track(useStoreInfo().ready)
}

const query = ref('')
const result = computed(() => (info.value ? checkOfficialNumber(query.value, info.value) : null))

const SCAM_SIGNS = [
  'Menawarkan harga jauh lebih murah dari katalog',
  'Mendesak transfer sebelum pesanan dibuat di website',
  'Rekening atas nama orang lain',
]
const REPORT_TEXT = 'Halo, saya mau melaporkan penipuan yang mengatasnamakan Suwandi SecondBranded.'
</script>

<template>
  <div class="mx-auto flex max-w-[1180px] flex-col gap-7 px-4 pt-6 pb-20 sm:px-6 lg:pt-11">
    <section class="flex flex-wrap items-stretch gap-7">
      <div class="flex min-w-0 flex-[999_1_520px] flex-col justify-center gap-4">
        <h1
          class="text-[32px] leading-[1.1] font-extrabold tracking-[-0.03em] lg:text-[clamp(32px,4vw,48px)]"
        >
          Kanal resmi Suwandi SecondBranded
        </h1>
        <p class="max-w-[52ch] text-[17px] leading-relaxed text-gray-700">
          Cuma rekening, nomor, dan akun di halaman ini yang milik kami. Selain itu, anggap
          penipuan.
        </p>
      </div>
      <form
        class="flex min-w-0 flex-[1_1_380px] flex-col gap-3 rounded-card border border-gray-200 bg-white p-5.5 shadow-card"
        @submit.prevent
      >
        <label class="flex flex-col gap-2 text-[15px] font-extrabold">
          Cek nomor yang menghubungimu
          <InputText
            v-model="query"
            type="tel"
            inputmode="tel"
            placeholder="Contoh: 0895 3837 13434"
            class="h-12 text-base font-medium"
            aria-describedby="check-hint"
            fluid
          />
          <span id="check-hint" class="text-xs font-normal text-gray-600"
            >Bisa nomor WhatsApp atau nomor rekening.</span
          >
        </label>
        <div
          v-if="result && (result.kind === 'whatsapp' || result.kind === 'bank')"
          role="status"
          class="flex items-start gap-2.5 rounded-control bg-success-bg px-3.5 py-3 text-sm leading-normal text-success-fg"
        >
          <CheckCircleIcon class="size-5 shrink-0" aria-hidden="true" />
          <span v-if="result.kind === 'whatsapp'"
            ><strong>Resmi.</strong> Ini WhatsApp toko kami.</span
          >
          <span v-else
            ><strong>Resmi.</strong> Ini rekening {{ result.bankName }} milik toko kami.</span
          >
        </div>
        <div
          v-else-if="result?.kind === 'unknown'"
          role="alert"
          class="flex items-start gap-2.5 rounded-control bg-danger-bg px-3.5 py-3 text-sm leading-normal text-danger-fg"
        >
          <XCircleIcon class="size-5 shrink-0" aria-hidden="true" />
          <span
            ><strong>Bukan kanal resmi.</strong> Jangan transfer. Laporkan ke WhatsApp resmi kami di
            bawah.</span
          >
        </div>
      </form>
    </section>

    <div
      role="note"
      class="flex flex-wrap items-center gap-3.5 rounded-card bg-danger-bg px-5 py-4.5 text-[#7F1D1D]"
    >
      <ShieldExclamationIcon class="size-7 shrink-0" aria-hidden="true" />
      <span class="flex-[1_1_400px] text-[15px] leading-normal">
        <strong>Kami tidak pernah meminta transfer ke rekening lain</strong>, meminta kode OTP, atau
        menjual sepatu lewat nomor pribadi pegawai. Semua pembayaran diproses lewat halaman pesanan
        di website ini.
      </span>
    </div>

    <div
      v-if="loadFailed"
      role="alert"
      class="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-10 text-center"
    >
      <p class="text-lg font-extrabold">Info kanal resmi belum bisa dimuat</p>
      <p class="text-sm text-gray-600">
        Jangan transfer ke mana pun sampai halaman ini bisa dibuka.
      </p>
      <AppButton label="Coba lagi" @click="retry" />
    </div>

    <div v-else-if="!info" class="grid gap-5 md:grid-cols-3" aria-busy="true">
      <Skeleton height="170px" border-radius="16px" class="md:col-span-2" />
      <Skeleton height="170px" border-radius="16px" />
    </div>

    <div v-else class="grid items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
      <section
        aria-labelledby="rek-h"
        class="flex min-w-0 flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-5.5 md:col-span-2"
      >
        <div class="flex flex-wrap items-center justify-between gap-2.5">
          <h2 id="rek-h" class="text-xl font-extrabold">Rekening resmi</h2>
          <span class="text-xs text-gray-600"
            >Diperbarui owner {{ formatDate(info.updatedAt) }}</span
          >
        </div>
        <ul
          v-if="info.bankAccounts.length"
          class="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3"
        >
          <li
            v-for="b in info.bankAccounts"
            :key="b.id"
            class="flex flex-col gap-1.5 rounded-control border border-brand-100 bg-[#F7FAF8] p-4"
          >
            <span class="flex items-center justify-between gap-2">
              <span class="font-extrabold">{{ b.bankName }}</span>
              <span
                class="rounded-full bg-success-bg px-[9px] py-[3px] text-[11px] font-extrabold text-success-fg"
                >Resmi</span
              >
            </span>
            <span class="text-xl font-extrabold tracking-[.02em] tabular-nums">{{
              b.accountNumber
            }}</span>
            <span class="text-[13px] text-gray-600">a.n. {{ b.accountName }}</span>
          </li>
        </ul>
        <p v-else class="text-sm text-gray-600">
          Belum ada rekening aktif. Jangan transfer sampai rekening resmi tercantum di sini.
        </p>
      </section>

      <section
        aria-labelledby="wa-h"
        class="flex flex-col gap-3 rounded-card bg-brand-700 p-5.5 text-white"
      >
        <h2 id="wa-h" class="text-xl font-extrabold">WhatsApp resmi</h2>
        <span class="text-2xl font-extrabold tabular-nums">{{ info.whatsapp }}</span>
        <span class="text-sm leading-normal text-brand-100"
          >Satu-satunya nomor toko. Pegawai tidak memakai nomor pribadi untuk jualan.</span
        >
        <a
          v-if="isRealPhone(info.whatsapp)"
          :href="whatsappLink(info.whatsapp, REPORT_TEXT)"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex h-11 items-center gap-2 self-start rounded-control bg-accent-400 px-4 text-sm font-extrabold text-gray-900 hover:bg-accent-500"
          >Lapor penipuan</a
        >
      </section>

      <section
        aria-labelledby="sos-h"
        class="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-5.5"
      >
        <h2 id="sos-h" class="text-xl font-extrabold">Media sosial</h2>
        <div class="flex items-center justify-between border-b border-gray-100 py-3">
          <span class="font-bold">Instagram</span
          ><span class="text-sm">{{ info.instagram || 'Belum ada' }}</span>
        </div>
        <div class="flex items-center justify-between py-3">
          <span class="font-bold">TikTok (live)</span
          ><span class="text-sm">{{ info.tiktok || 'Belum ada' }}</span>
        </div>
        <span class="text-[13px] leading-normal text-gray-600"
          >Akun dengan nama mirip tapi beda satu huruf bukan milik kami.</span
        >
      </section>

      <section
        aria-labelledby="loc-h"
        class="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-5.5"
      >
        <h2 id="loc-h" class="text-xl font-extrabold">Toko fisik</h2>
        <!-- Peta: tautan ke Google Maps (embed butuh API key + skrip pihak ketiga) -->
        <a
          :href="mapsLink(info.address)"
          target="_blank"
          rel="noopener noreferrer"
          class="flex h-[140px] flex-col items-center justify-center gap-2 rounded-control bg-photo text-[13px] font-bold text-brand-700 hover:bg-brand-100"
        >
          <MapPinIcon class="size-7" aria-hidden="true" />Buka di Google Maps
        </a>
        <p class="text-sm leading-normal">
          {{ info.address }}
          <template v-for="h in info.openingHours" :key="h.days"
            ><br />{{ h.days }} {{ h.hours }}</template
          >
        </p>
      </section>

      <section
        aria-labelledby="tip-h"
        class="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-5.5"
      >
        <h2 id="tip-h" class="text-xl font-extrabold">Tanda penipu</h2>
        <ul class="flex flex-col gap-3 text-sm leading-normal">
          <li v-for="s in SCAM_SIGNS" :key="s" class="flex gap-2.5">
            <ExclamationTriangleIcon class="size-5 shrink-0 text-danger-fg" aria-hidden="true" />{{
              s
            }}
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
