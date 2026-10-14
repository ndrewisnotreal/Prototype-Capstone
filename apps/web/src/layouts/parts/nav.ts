// Tautan navigasi storefront, dipakai SiteHeader, SiteFooter, dan MobileTabBar.
export const STOREFRONT_LINKS = [
  { label: 'Beranda', to: '/' },
  { label: 'Katalog', to: '/katalog' },
  { label: 'Cara Belanja', to: '/#cara-belanja' },
  { label: 'Kanal Resmi', to: '/kanal-resmi' },
] as const

/** Inisial untuk avatar: "Rizky Siregar" → "RS". */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
