// API publik modul: hanya yang diekspor di sini boleh di-import modul lain.
// Widget dipasang di StorefrontLayout; halaman membuka chat lewat useChatStore().open().
export { default as ChatWidget } from './components/ChatWidget.vue'
export { useChatStore } from './stores/chat.store'
