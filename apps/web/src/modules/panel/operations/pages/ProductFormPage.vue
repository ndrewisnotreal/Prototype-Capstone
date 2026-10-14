<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ExclamationTriangleIcon, LockClosedIcon } from '@heroicons/vue/24/outline'
import {
  CONDITION_LABELS,
  Condition,
  type PanelProductDetailDto,
  type ProductCardDto,
} from '@ssb/shared'
import { useConfirmAction, useNotify, useRequest } from '@/shared/composables'
import { ApiRequestError } from '@/shared/lib'
import { AppButton, FormField, ProductCard } from '@/shared/ui'
import { panelProductsApi, type ProductFormValues } from '../api/products.api'
import ProductPhotosField, { type PhotoItem } from '../components/ProductPhotosField.vue'

// Layar P-ProdukForm (+ M-ProdukForm responsif). Satu halaman untuk tambah (/baru) dan edit (/:id/edit).
const route = useRoute()
const router = useRouter()
const notify = useNotify()
const confirm = useConfirmAction()

const editId = computed(() => (route.params.id ? Number(route.params.id) : null))
const brands = useRequest(() => panelProductsApi.brands())
const categories = useRequest(() => panelProductsApi.categories())

const CONDITION_HINTS: Record<Condition, string> = {
  LIKE_NEW: 'Hampir tanpa bekas',
  VERY_GOOD: 'Bekas pakai ringan',
  GOOD: 'Ada minus kecil',
  FAIR: 'Minus jelas',
}

const emptyForm = (): ProductFormValues => ({
  brandId: null,
  categoryId: null,
  model: '',
  sizeEu: null,
  sizeUk: null,
  sizeUs: null,
  insoleCm: null,
  condition: '',
  defects: '',
  hasBox: false,
  hasOriginalInsole: true,
  hasOriginalLaces: true,
  price: null,
  description: '',
})
const form = reactive(emptyForm())
const errors = reactive<Partial<Record<keyof ProductFormValues | 'photos', string>>>({})
const live = ref(true)
const serverErrors = ref<string[]>([])
const saving = ref<'' | 'save' | 'again'>('')

// ---------- Edit: muat produk ----------
const product = ref<PanelProductDetailDto | null>(null)
const loadError = ref('')
const locked = computed(
  () => product.value?.status === 'RESERVED' || product.value?.status === 'SOLD',
)
function fill(p: PanelProductDetailDto) {
  product.value = p
  Object.assign(form, {
    brandId: p.brandId,
    categoryId: p.category.id,
    model: p.model,
    sizeEu: p.sizeEu,
    sizeUk: p.sizeUk,
    sizeUs: p.sizeUs,
    insoleCm: p.insoleCm,
    condition: p.condition,
    defects: p.defects.join('\n'),
    hasBox: p.hasBox,
    hasOriginalInsole: p.hasOriginalInsole,
    hasOriginalLaces: p.hasOriginalLaces,
    price: p.price,
    description: p.description ?? '',
  })
  live.value = p.status !== 'INACTIVE'
}
watch(
  editId,
  async (id) => {
    if (!id) return
    if (!Number.isInteger(id)) {
      loadError.value = 'Sepatu tidak ditemukan.'
      return
    }
    try {
      fill(await panelProductsApi.get(id))
    } catch (e) {
      loadError.value = e instanceof ApiRequestError ? e.message : 'Produk gagal dimuat.'
    }
  },
  { immediate: true },
)

// ---------- Foto ----------
// Tambah: file ditahan di browser sampai disimpan. Edit: tiap aksi langsung ke API.
const localPhotos = ref<(PhotoItem & { file: File })[]>([])
const photoBusy = ref(false)
const photos = computed<PhotoItem[]>(() =>
  editId.value
    ? (product.value?.photos ?? []).map((p) => ({ key: p.id, url: p.url, isPrimary: p.isPrimary }))
    : localPhotos.value,
)

async function photoAction(run: () => Promise<PanelProductDetailDto>) {
  photoBusy.value = true
  errors.photos = ''
  try {
    product.value = await run()
  } catch (e) {
    errors.photos = e instanceof ApiRequestError ? e.message : 'Gagal memperbarui foto.'
  } finally {
    photoBusy.value = false
  }
}
const serverIds = () => product.value!.photos.map((p) => p.id)
const serverPrimary = () => product.value!.photos.find((p) => p.isPrimary)?.id ?? serverIds()[0]

function addPhotos(files: File[]) {
  if (editId.value) return photoAction(() => panelProductsApi.addPhotos(editId.value!, files))
  const hasPrimary = localPhotos.value.some((p) => p.isPrimary)
  localPhotos.value.push(
    ...files.map((file, i) => ({
      key: `${file.name}-${file.lastModified}-${Math.random()}`,
      url: URL.createObjectURL(file),
      file,
      isPrimary: !hasPrimary && i === 0,
    })),
  )
}
async function removePhoto(i: number) {
  if (editId.value) {
    const photo = product.value!.photos[i]
    const ok = await confirm({
      title: 'Hapus foto ini?',
      message: 'Foto langsung terhapus dari katalog. Minimal 3 foto harus tersisa.',
      acceptLabel: 'Hapus foto',
      danger: true,
    })
    if (ok) await photoAction(() => panelProductsApi.removePhoto(editId.value!, photo.id))
    return
  }
  const [removed] = localPhotos.value.splice(i, 1)
  URL.revokeObjectURL(removed.url)
  if (removed.isPrimary && localPhotos.value[0]) localPhotos.value[0].isPrimary = true
}
function movePhoto(from: number, to: number) {
  if (editId.value) {
    const ids = serverIds()
    ids.splice(to, 0, ids.splice(from, 1)[0])
    return photoAction(() => panelProductsApi.reorderPhotos(editId.value!, ids, serverPrimary()))
  }
  localPhotos.value.splice(to, 0, localPhotos.value.splice(from, 1)[0])
}
function setPrimary(i: number) {
  if (editId.value) {
    const ids = serverIds()
    return photoAction(() => panelProductsApi.reorderPhotos(editId.value!, ids, ids[i]))
  }
  localPhotos.value.forEach((p, j) => (p.isPrimary = j === i))
}

// Pesan error hilang begitu field-nya diubah, tidak menunggu klik Simpan lagi
watch(
  () => ({ ...form }),
  (now, before) => {
    for (const k of Object.keys(now) as (keyof ProductFormValues)[])
      if (now[k] !== before[k]) delete errors[k]
  },
)
watch(
  () => photos.value.length,
  () => delete errors.photos,
)

// ---------- Validasi + simpan ----------
function validate(): boolean {
  const e: typeof errors = {}
  if (!form.brandId) e.brandId = 'Pilih merek'
  if (!form.categoryId) e.categoryId = 'Pilih kategori'
  if (form.model.trim().length < 2) e.model = 'Nama atau model minimal 2 karakter'
  if (form.sizeEu === null) e.sizeEu = 'Ukuran EU wajib diisi'
  else if (form.sizeEu < 30 || form.sizeEu > 50) e.sizeEu = 'Ukuran EU antara 30 dan 50'
  if (!form.condition) e.condition = 'Pilih kondisi'
  if (form.price === null || form.price < 1000) e.price = 'Harga minimal Rp 1.000'
  if (!editId.value && (localPhotos.value.length < 3 || localPhotos.value.length > 6))
    e.photos = 'Unggah 3 sampai 6 foto.'
  for (const k of Object.keys(errors) as (keyof typeof errors)[]) delete errors[k]
  Object.assign(errors, e)
  return Object.keys(e).length === 0
}

const payload = (): ProductFormValues => ({ ...form, model: form.model.trim() })

async function save(again = false) {
  serverErrors.value = []
  if (!validate()) {
    notify.error('Masih ada isian yang perlu diperbaiki.')
    return
  }
  saving.value = again ? 'again' : 'save'
  try {
    if (editId.value) {
      const values = payload()
      if (locked.value) delete (values as Partial<ProductFormValues>).price // harga terkunci, jangan dikirim
      let updated = await panelProductsApi.update(editId.value, values)
      const wanted = live.value ? 'AVAILABLE' : 'INACTIVE'
      if (!locked.value && updated.status !== wanted) {
        updated = await panelProductsApi.setStatus(editId.value, wanted)
      }
      notify.success(`${updated.code} tersimpan.`)
      await router.push('/panel/produk')
      return
    }
    const primary = localPhotos.value.findIndex((p) => p.isPrimary)
    let created = await panelProductsApi.create(
      payload(),
      live.value ? 'AVAILABLE' : 'INACTIVE',
      localPhotos.value.map((p) => p.file),
    )
    // Server menjadikan foto pertama sebagai utama; sesuaikan kalau pegawai memilih yang lain
    if (primary > 0) {
      const ids = created.photos.map((p) => p.id)
      created = await panelProductsApi.reorderPhotos(created.id, ids, ids[primary])
    }
    notify.success(
      `${created.code} tersimpan${live.value ? ' dan tampil di katalog' : ' sebagai Nonaktif'}.`,
    )
    if (again) {
      localPhotos.value.forEach((p) => URL.revokeObjectURL(p.url))
      localPhotos.value = []
      Object.assign(form, emptyForm())
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      await router.push('/panel/produk')
    }
  } catch (e) {
    const details =
      e instanceof ApiRequestError ? (e.details?.errors as string[] | undefined) : undefined
    serverErrors.value = details ?? [
      e instanceof ApiRequestError ? e.message : 'Gagal menyimpan sepatu.',
    ]
  } finally {
    saving.value = ''
  }
}

// ---------- Pratinjau kartu ----------
const preview = computed<ProductCardDto>(() => ({
  code: product.value?.code ?? 'SSB-BARU',
  brand: brands.data.value?.find((b) => b.id === form.brandId)?.name ?? 'Merek',
  model: form.model.trim() || 'Nama model',
  sizeEu: form.sizeEu ?? 0,
  condition: (form.condition || 'VERY_GOOD') as Condition,
  price: form.price ?? 0,
  status:
    product.value && locked.value ? product.value.status : live.value ? 'AVAILABLE' : 'INACTIVE',
  primaryPhotoUrl: photos.value.find((p) => p.isPrimary)?.url ?? photos.value[0]?.url ?? null,
  isNew: !product.value,
}))
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <RouterLink to="/panel/produk" class="text-[13px] font-bold text-brand-700"
        >Daftar produk</RouterLink
      >
      <h1 class="mt-1 text-[28px] font-extrabold tracking-tight">
        {{ editId ? 'Edit sepatu' : 'Tambah sepatu' }}
      </h1>
    </div>
    <span class="text-[13px] text-gray-600">
      <template v-if="product"
        >Kode: <strong class="text-gray-900">{{ product.code }}</strong></template
      >
      <template v-else-if="!editId">Kode dibuat otomatis saat disimpan</template>
    </span>
  </header>

  <div
    v-if="loadError"
    role="alert"
    class="rounded-card border border-gray-200 bg-white px-6 py-12 text-center"
  >
    <p class="text-lg font-extrabold">{{ loadError }}</p>
    <RouterLink to="/panel/produk" class="mt-2 inline-block font-bold text-brand-700"
      >Kembali ke daftar produk</RouterLink
    >
  </div>

  <div v-else-if="editId && !product" class="flex flex-col gap-4" aria-busy="true">
    <Skeleton height="180px" border-radius="16px" />
    <Skeleton height="260px" border-radius="16px" />
  </div>

  <div v-else class="flex flex-wrap items-start gap-6">
    <form
      class="flex min-w-0 flex-[999_1_560px] flex-col gap-4.5"
      novalidate
      @submit.prevent="save(false)"
    >
      <div
        v-if="serverErrors.length"
        role="alert"
        class="flex gap-2.5 rounded-control bg-danger-bg px-4 py-3 text-sm font-semibold text-danger-fg"
      >
        <ExclamationTriangleIcon class="size-5 shrink-0" aria-hidden="true" />
        <ul class="flex flex-col gap-1">
          <li v-for="m in serverErrors" :key="m">{{ m }}</li>
        </ul>
      </div>

      <ProductPhotosField
        :photos="photos"
        :busy="photoBusy"
        :error="errors.photos"
        @add="addPhotos"
        @remove="removePhoto"
        @move="movePhoto"
        @primary="setPrimary"
      />

      <fieldset class="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-5">
        <legend class="float-left text-[17px] font-extrabold">Info sepatu</legend>
        <div class="clear-both grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
          <FormField v-slot="f" label="Merek" :error="errors.brandId" required>
            <Select
              v-model="form.brandId"
              :label-id="f.id"
              :invalid="f.invalid"
              :options="brands.data.value ?? []"
              option-label="name"
              option-value="id"
              placeholder="Pilih merek"
              fluid
            />
          </FormField>
          <FormField v-slot="f" label="Nama atau model" :error="errors.model" required>
            <InputText
              v-model="form.model"
              v-bind="f.input"
              placeholder="mis. Dunk Low Panda"
              fluid
            />
          </FormField>
          <FormField v-slot="f" label="Kategori" :error="errors.categoryId" required>
            <Select
              v-model="form.categoryId"
              :label-id="f.id"
              :invalid="f.invalid"
              :options="categories.data.value ?? []"
              option-label="name"
              option-value="id"
              placeholder="Pilih kategori"
              fluid
            />
          </FormField>
        </div>
        <div class="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <FormField v-slot="f" label="EU" :error="errors.sizeEu" required>
            <InputNumber
              v-model="form.sizeEu"
              :input-id="f.id"
              :invalid="f.invalid"
              locale="id-ID"
              :max-fraction-digits="1"
              :use-grouping="false"
              fluid
            />
          </FormField>
          <FormField v-slot="f" label="UK" hint="opsional">
            <InputNumber
              v-model="form.sizeUk"
              :input-id="f.id"
              locale="id-ID"
              :max-fraction-digits="1"
              :use-grouping="false"
              fluid
            />
          </FormField>
          <FormField v-slot="f" label="US" hint="opsional">
            <InputNumber
              v-model="form.sizeUs"
              :input-id="f.id"
              locale="id-ID"
              :max-fraction-digits="1"
              :use-grouping="false"
              fluid
            />
          </FormField>
          <FormField v-slot="f" label="Insole (cm)" hint="diukur manual">
            <InputNumber
              v-model="form.insoleCm"
              :input-id="f.id"
              locale="id-ID"
              :max-fraction-digits="1"
              :use-grouping="false"
              fluid
            />
          </FormField>
        </div>
      </fieldset>

      <fieldset class="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-5">
        <legend class="float-left text-[17px] font-extrabold">
          Kondisi <span class="text-danger-fg" aria-hidden="true">*</span>
        </legend>
        <div
          role="radiogroup"
          aria-label="Kondisi"
          class="clear-both grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          <button
            v-for="c in Object.values(Condition)"
            :key="c"
            type="button"
            role="radio"
            :aria-checked="form.condition === c"
            class="flex min-h-16 flex-col gap-0.5 rounded-control border-2 px-3 py-2.5 text-left"
            :class="
              form.condition === c ? 'border-brand-600 bg-[#F7FAF8]' : 'border-gray-200 bg-white'
            "
            @click="form.condition = c"
          >
            <span class="text-sm font-extrabold">{{ CONDITION_LABELS[c] }}</span>
            <span class="text-xs text-gray-600">{{ CONDITION_HINTS[c] }}</span>
          </button>
        </div>
        <p v-if="errors.condition" class="text-xs font-semibold text-danger-fg" role="alert">
          {{ errors.condition }}
        </p>
        <FormField
          v-slot="f"
          label="Minus atau cacat"
          hint="Satu minus per baris, contoh: creasing ringan di toe box"
        >
          <Textarea v-model="form.defects" v-bind="f.input" rows="3" auto-resize fluid />
        </FormField>
        <div class="flex flex-wrap gap-5">
          <label class="flex min-h-11 items-center gap-2.5 text-sm"
            ><Checkbox v-model="form.hasBox" binary /> Box asli</label
          >
          <label class="flex min-h-11 items-center gap-2.5 text-sm"
            ><Checkbox v-model="form.hasOriginalInsole" binary /> Insole asli</label
          >
          <label class="flex min-h-11 items-center gap-2.5 text-sm"
            ><Checkbox v-model="form.hasOriginalLaces" binary /> Tali asli</label
          >
        </div>
      </fieldset>

      <fieldset class="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-5">
        <legend class="float-left text-[17px] font-extrabold">Harga dan deskripsi</legend>
        <FormField
          v-slot="f"
          label="Harga (Rp)"
          :error="errors.price"
          required
          class="clear-both max-w-[280px]"
        >
          <InputNumber
            v-model="form.price"
            :input-id="f.id"
            :invalid="f.invalid"
            :disabled="locked"
            prefix="Rp "
            locale="id-ID"
            :max-fraction-digits="0"
            input-class="font-bold"
            fluid
          />
        </FormField>
        <p v-if="locked" class="-mt-1.5 flex items-center gap-1.5 text-xs text-gray-600">
          <LockClosedIcon class="size-4" aria-hidden="true" />Harga terkunci karena sepatu sedang
          dipesan atau sudah terjual.
        </p>
        <FormField v-slot="f" label="Deskripsi">
          <Textarea v-model="form.description" v-bind="f.input" rows="3" auto-resize fluid />
        </FormField>
      </fieldset>
    </form>

    <aside
      aria-label="Pratinjau kartu katalog"
      class="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5 lg:sticky lg:top-6"
    >
      <div class="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4.5">
        <span class="text-sm font-extrabold">Pratinjau di katalog</span>
        <!-- inert: kartu hanya pratinjau, tidak bisa diklik/difokus -->
        <div inert class="w-full max-w-[260px] self-center">
          <ProductCard :product="preview" />
        </div>
      </div>
      <div class="flex flex-col gap-2.5 rounded-card border border-gray-200 bg-white p-4.5">
        <label
          class="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold"
          :class="locked && 'cursor-not-allowed opacity-60'"
        >
          <ToggleSwitch v-model="live" :disabled="locked" />
          {{ live ? 'Langsung tampil di katalog (Tersedia)' : 'Simpan sebagai Nonaktif dulu' }}
        </label>
        <AppButton
          :label="editId ? 'Simpan perubahan' : 'Simpan sepatu'"
          :loading="saving === 'save'"
          :disabled="!!saving"
          size="lg"
          class="w-full"
          @click="save(false)"
        />
        <AppButton
          v-if="!editId"
          variant="secondary"
          label="Simpan dan tambah lagi"
          :loading="saving === 'again'"
          :disabled="!!saving"
          size="lg"
          class="w-full"
          @click="save(true)"
        />
      </div>
    </aside>
  </div>
</template>
