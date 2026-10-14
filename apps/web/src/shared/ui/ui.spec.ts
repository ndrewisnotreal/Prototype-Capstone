import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import FormField from './FormField.vue'
import StatusBadge from './StatusBadge.vue'

describe('StatusBadge', () => {
  it('memakai label dan warna dari @ssb/shared', () => {
    const badge = mount(StatusBadge, { props: { type: 'order', status: 'CANCELLED' } })
    expect(badge.text()).toBe('Dibatalkan')
    expect(badge.classes()).toContain('bg-danger-bg')
  })

  it('Belum Dibayar memakai gaya outline sesuai DS-Components', () => {
    const badge = mount(StatusBadge, { props: { type: 'payment', status: 'UNPAID' } })
    expect(badge.text()).toBe('Belum Dibayar')
    expect(badge.classes()).toContain('bg-white')
  })
})

describe('FormField', () => {
  const mountField = (props: { error?: string; hint?: string }) =>
    mount(FormField, {
      props: { label: 'Email', ...props },
      slots: { default: ({ input }: { input: Record<string, unknown> }) => h('input', input) },
    })

  it('menghubungkan label dan pesan error ke input', () => {
    const field = mountField({ error: 'Format email belum benar' })
    const input = field.get('input')
    expect(field.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(input.attributes('aria-invalid')).toBe('true')
    const message = field.get(`#${input.attributes('aria-describedby')}`)
    expect(message.text()).toBe('Format email belum benar')
  })

  it('tanpa error: hint jadi deskripsi dan input tidak ditandai invalid', () => {
    const input = mountField({ hint: 'Dipakai untuk login' }).get('input')
    expect(input.attributes('aria-invalid')).toBeUndefined()
    expect(input.attributes('aria-describedby')).toBeDefined()
  })
})
