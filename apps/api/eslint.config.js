import tseslint from 'typescript-eslint'

export default tseslint.config({ ignores: ['dist/**'] }, tseslint.configs.recommended, {
  files: ['**/*.ts'],
  languageOptions: { parserOptions: { projectService: true } },
  rules: {
    // promise yang lupa di-await di service = bug transaksi yang sulit dilacak
    '@typescript-eslint/no-floating-promises': 'error',
  },
})
