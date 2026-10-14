import { useToast } from 'primevue/usetoast'

// Notifikasi singkat. Sukses memakai severity contrast (toast gelap sesuai DS-Components).
export function useNotify() {
  const toast = useToast()
  return {
    success: (message: string) => toast.add({ severity: 'contrast', summary: message, life: 4000 }),
    error: (message: string) => toast.add({ severity: 'error', summary: message, life: 6000 }),
    info: (message: string) => toast.add({ severity: 'secondary', summary: message, life: 4000 }),
  }
}
