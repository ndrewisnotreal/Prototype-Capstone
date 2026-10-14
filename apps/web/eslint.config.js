import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs(
  { ignores: ['dist/**', 'src/components.d.ts'] },
  // essential: tanpa aturan format, format diurus Prettier
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  // Batas modul, lihat docs/architecture.md "Aturan import"
  {
    files: ['src/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // boleh: @/modules/auth, @/modules/panel/operations (index.ts). dilarang: file di dalamnya
              group: ['@/modules/*/*', '!@/modules/panel/*', '@/modules/panel/*/*'],
              message: 'Import modul lain hanya lewat index.ts-nya (mis. @/modules/auth).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/shared/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules/*', '@/layouts/*'],
              message: 'shared tidak boleh bergantung pada modul atau layout.',
            },
          ],
        },
      ],
    },
  },
)
