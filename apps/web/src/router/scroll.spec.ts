import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { scrollBehavior } from './scroll'

const to = (hash = '') => ({ hash }) as RouteLocationNormalized
const from = to()

describe('scrollBehavior', () => {
  it('tautan #bagian (Cara Belanja) menggulir ke bagian itu, bukan ke atas', () => {
    expect(scrollBehavior(to('#cara-belanja'), from, null)).toEqual({
      el: '#cara-belanja',
      top: 16,
      behavior: 'smooth',
    })
  })

  it('tanpa hash ke atas; tombol kembali memakai posisi tersimpan', () => {
    expect(scrollBehavior(to(), from, null)).toEqual({ top: 0 })
    expect(scrollBehavior(to('#cara-belanja'), from, { left: 0, top: 640 })).toEqual({
      left: 0,
      top: 640,
    })
  })
})
