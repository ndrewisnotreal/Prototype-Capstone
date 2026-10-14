/*
 * Preset PrimeVue untuk Suwandi SecondBranded.
 * Salin ke apps/web/src/app/primevue/preset.ts (T-0.3). Dipakai di apps/web/src/app/primevue/index.ts.
 *
 * Basis: Aura dari @primeuix/themes 2.x (pasangan PrimeVue 4.5.x, lisensi MIT).
 * Nilai hex di sini HARUS sama dengan docs/design/tokens/theme.css. Kalau salah satu berubah, ubah keduanya.
 * Nilai bertanda "turunan" tidak ada di desain, dihitung dari warna di kiri-kanannya.
 *
 * Setelah dipasang, cek visual di halaman /dev/ui (T-1.2) terhadap layar DS-Components:
 * tinggi tombol/input 44px, radius 12, border input #D1D5DB, fokus ring hijau.
 */
import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

export const SsbPreset = definePreset(Aura, {
  primitive: {
    // md = 12px (tombol, input), xl = 16px (dialog, drawer, kartu)
    borderRadius: { none: '0', xs: '4px', sm: '8px', md: '12px', lg: '14px', xl: '16px' },
    brand: {
      50: '#EEF4F1',
      100: '#D7E5DE',
      200: '#B0CBBE',
      300: '#90B0A2', // turunan
      400: '#6F9585', // turunan
      500: '#4F7A69',
      600: '#3B5D50', // tombol primer
      700: '#2F4B41', // hover, tautan
      800: '#233930', // turunan
      900: '#18271F', // sidebar panel
      950: '#0E1513', // latar dark mode
    },
    accent: {
      100: '#FDF1CF',
      400: '#F9BF29',
      500: '#E0A50F',
      600: '#C99206', // turunan, warna saat ditekan
      700: '#6B4A00',
    },
  },
  semantic: {
    primary: {
      50: '{brand.50}',
      100: '{brand.100}',
      200: '{brand.200}',
      300: '{brand.300}',
      400: '{brand.400}',
      500: '{brand.500}',
      600: '{brand.600}',
      700: '{brand.700}',
      800: '{brand.800}',
      900: '{brand.900}',
      950: '{brand.950}',
    },
    // sama dengan :focus-visible di theme.css
    focusRing: {
      width: '3px',
      style: 'solid',
      color: 'rgba(59, 93, 80, 0.45)',
      offset: '2px',
      shadow: 'none',
    },
    formField: {
      paddingX: '0.875rem', // 14px
      paddingY: '0.575rem', // 9.2px + line-height 25.6 + border 2 = tinggi 44px
      borderRadius: '{border.radius.md}',
      // input, Select, DatePicker: ring sama dengan tombol; bawaan Aura hanya mengganti warna border 1px (T-7.2)
      focusRing: {
        width: '3px',
        style: 'solid',
        color: 'rgba(59, 93, 80, 0.45)',
        offset: '0',
        shadow: 'none',
      },
    },
    colorScheme: {
      light: {
        // surface = abu desain (Tailwind gray), bukan slate bawaan Aura
        surface: {
          0: '#ffffff',
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
          950: '#030712',
        },
        primary: {
          color: '{primary.600}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.700}',
          activeColor: '{primary.800}',
        },
        highlight: {
          background: '{primary.50}',
          focusBackground: '{primary.100}',
          color: '{primary.700}',
          focusColor: '{primary.800}',
        },
        formField: {
          borderColor: '{surface.300}',
          hoverBorderColor: '{surface.400}',
          invalidBorderColor: '#DC2626',
          color: '{surface.900}',
          placeholderColor: '{surface.500}',
        },
        text: {
          color: '{surface.900}',
          hoverColor: '{surface.900}',
          mutedColor: '{surface.600}', // #4B5563, aman di latar abu (lihat aturan kontras)
          hoverMutedColor: '{surface.700}',
        },
      },
      dark: {
        // dari token dark di design-system.md
        surface: {
          0: '#ffffff',
          50: '#ECF1EE',
          100: '#D5DEDA',
          200: '#BCC9C3',
          300: '#A7B6AF',
          400: '#A7B6AF',
          500: '#7E8F87',
          600: '#55665E',
          700: '#2A3A33',
          800: '#1C2A24',
          900: '#15201B',
          950: '#0E1513',
        },
        primary: {
          color: '{primary.500}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.400}',
          activeColor: '{primary.300}',
        },
        text: {
          color: '{surface.50}',
          hoverColor: '{surface.0}',
          mutedColor: '{surface.300}',
          hoverMutedColor: '{surface.200}',
        },
      },
    },
  },
  components: {
    // Varian AppButton -> severity PrimeVue:
    // primer = (default), aksen = warn, sekunder = secondary, ghost = variant="text", bahaya = danger
    button: {
      root: {
        paddingX: '1.125rem', // 18px
        label: { fontWeight: '700' },
      },
      colorScheme: {
        light: {
          root: {
            warn: {
              background: '{accent.400}',
              hoverBackground: '{accent.500}',
              activeBackground: '{accent.600}',
              borderColor: '{accent.400}',
              hoverBorderColor: '{accent.500}',
              activeBorderColor: '{accent.600}',
              color: '#111827',
              hoverColor: '#111827',
              activeColor: '#111827',
              focusRing: { color: '{accent.500}', shadow: 'none' },
            },
            secondary: {
              background: '#ffffff',
              hoverBackground: '{surface.50}',
              activeBackground: '{surface.100}',
              borderColor: '{surface.300}',
              hoverBorderColor: '{surface.400}',
              activeBorderColor: '{surface.400}',
              color: '{surface.900}',
              hoverColor: '{surface.900}',
              activeColor: '{surface.900}',
              focusRing: { color: '{primary.600}', shadow: 'none' },
            },
            danger: {
              background: '#B91C1C',
              hoverBackground: '#991B1B',
              activeBackground: '#7F1D1D',
              borderColor: '#B91C1C',
              hoverBorderColor: '#991B1B',
              activeBorderColor: '#7F1D1D',
              color: '#ffffff',
              hoverColor: '#ffffff',
              activeColor: '#ffffff',
              focusRing: { color: 'rgba(185, 28, 28, 0.35)', shadow: 'none' },
            },
          },
          text: {
            primary: {
              hoverBackground: '{primary.50}',
              activeBackground: '{primary.100}',
              color: '{primary.700}',
            },
          },
        },
      },
    },
    // useNotify: sukses = severity contrast (gelap, bawaan Aura sudah sama dengan desain), gagal = error di bawah
    toast: {
      colorScheme: {
        light: {
          error: {
            background: '#FEE2E2',
            borderColor: '#FECACA',
            color: '#991B1B',
            detailColor: '#991B1B',
            closeButton: {
              hoverBackground: '#FECACA',
              focusRing: { color: '#991B1B', shadow: 'none' },
            },
          },
        },
      },
    },
  },
})
