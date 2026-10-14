// API publik modul: hanya yang diekspor di sini boleh di-import modul lain.
export { routes } from './routes'
// Dipakai halaman lain untuk data yang tidak ditemukan (mis. kode sepatu salah), supaya tampilannya sama dengan 404
export { default as NotFoundPage } from './pages/NotFoundPage.vue'
