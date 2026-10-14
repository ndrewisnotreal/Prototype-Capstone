import { useConfirm } from 'primevue/useconfirm'

export interface ConfirmOptions {
  title: string
  message: string
  acceptLabel: string
  rejectLabel?: string
  /** true = tombol konfirmasi merah (batalkan, hapus, tolak) */
  danger?: boolean
}

// Modal konfirmasi sebagai Promise: `if (await confirm({...})) { ... }`
export function useConfirmAction() {
  const confirm = useConfirm()
  return (options: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      let answered = false
      const answer = (value: boolean) => {
        if (answered) return
        answered = true
        resolve(value)
      }
      confirm.require({
        header: options.title,
        message: options.message,
        acceptProps: {
          label: options.acceptLabel,
          severity: options.danger ? 'danger' : undefined,
        },
        rejectProps: { label: options.rejectLabel ?? 'Kembali', severity: 'secondary' },
        accept: () => answer(true),
        reject: () => answer(false),
        onHide: () => answer(false), // ditutup lewat Esc atau tombol silang
      })
    })
}
