/*
 * Pemasangan PrimeVue. Salin ke apps/web/src/app/primevue/index.ts (T-0.3), lalu di main.ts:
 *   import { installPrimeVue } from '@/app/primevue';
 *   installPrimeVue(app);
 *
 * Komponen PrimeVue TIDAK didaftarkan global. Komponen di-import otomatis oleh
 * unplugin-vue-components + PrimeVueResolver (lihat vite.config.ts di ADR-0004), jadi tree-shaking tetap jalan.
 */
import type { App } from 'vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import { SsbPreset } from './preset'

// Teks bawaan PrimeVue dalam Bahasa Indonesia. Kunci yang tidak ditulis tetap memakai default.
const localeId = {
  accept: 'Ya',
  reject: 'Batal',
  choose: 'Pilih',
  upload: 'Unggah',
  cancel: 'Batal',
  clear: 'Hapus',
  apply: 'Terapkan',
  today: 'Hari ini',
  completed: 'Selesai',
  pending: 'Menunggu',
  dayNames: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
  dayNamesShort: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
  dayNamesMin: ['Mg', 'Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb'],
  monthNames: [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ],
  monthNamesShort: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ],
  chooseYear: 'Pilih tahun',
  chooseMonth: 'Pilih bulan',
  chooseDate: 'Pilih tanggal',
  prevMonth: 'Bulan sebelumnya',
  nextMonth: 'Bulan berikutnya',
  prevYear: 'Tahun sebelumnya',
  nextYear: 'Tahun berikutnya',
  weekHeader: 'Mg',
  firstDayOfWeek: 1,
  dateFormat: 'dd/mm/yy',
  weak: 'Lemah',
  medium: 'Sedang',
  strong: 'Kuat',
  passwordPrompt: 'Masukkan password',
  emptyFilterMessage: 'Tidak ada hasil',
  emptySearchMessage: 'Tidak ada hasil',
  emptyMessage: 'Tidak ada pilihan',
  searchMessage: '{0} hasil tersedia',
  selectionMessage: '{0} dipilih',
  emptySelectionMessage: 'Belum ada yang dipilih',
  fileChosenMessage: '{0} file',
  noFileChosenMessage: 'Belum ada file',
  // Label pembaca layar komponen PrimeVue (digabung dengan bawaan, kunci lain tetap bahasa Inggris)
  aria: {
    close: 'Tutup',
    previous: 'Sebelumnya',
    next: 'Berikutnya',
    navigation: 'Navigasi',
    scrollTop: 'Kembali ke atas',
    trueLabel: 'Ya',
    falseLabel: 'Tidak',
    nullLabel: 'Belum dipilih',
    selectAll: 'Semua dipilih',
    unselectAll: 'Semua batal dipilih',
    pageLabel: 'Halaman {page}',
    firstPageLabel: 'Halaman pertama',
    lastPageLabel: 'Halaman terakhir',
    nextPageLabel: 'Halaman berikutnya',
    prevPageLabel: 'Halaman sebelumnya',
    rowsPerPageLabel: 'Baris per halaman',
    selectRow: 'Baris dipilih',
    unselectRow: 'Baris batal dipilih',
    expandRow: 'Baris dibuka',
    collapseRow: 'Baris ditutup',
    zoomImage: 'Perbesar foto',
    zoomIn: 'Perbesar',
    zoomOut: 'Perkecil',
    listLabel: 'Daftar pilihan',
  },
}

export function installPrimeVue(app: App) {
  app.use(PrimeVue, {
    theme: {
      preset: SsbPreset,
      options: {
        prefix: 'p',
        darkModeSelector: '.dark', // sama dengan @custom-variant dark di main.css
        cssLayer: { name: 'primevue', order: 'theme, base, primevue' }, // utilities Tailwind tetap menang
      },
    },
    locale: localeId,
    ripple: false,
    pt: {
      // Input Password adalah textbox, bukan combobox: aria-expanded/haspopup di sana tidak sah (audit axe T-7.2)
      password: {
        pcInputText: { root: { 'aria-expanded': undefined, 'aria-haspopup': undefined } },
      },
      // Tab dipakai sebagai filter tanpa TabPanel, jadi aria-controls menunjuk elemen yang tidak ada
      tab: { root: { 'aria-controls': undefined } },
    },
  })
  app.use(ToastService)
  app.use(ConfirmationService)
  app.directive('tooltip', Tooltip)
}
