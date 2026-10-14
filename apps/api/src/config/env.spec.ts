import { validateEnv } from './env.js'

const valid = {
  DATABASE_URL: 'postgresql://ssb:ssb@localhost:5432/ssb',
  JWT_SECRET: 'x'.repeat(32),
}

describe('validateEnv', () => {
  it('mengisi default dan mengubah PORT ke angka', () => {
    expect(validateEnv({ ...valid, PORT: '4000' })).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
    })
  })

  it('menolak env yang hilang atau lemah dengan pesan per variabel', () => {
    expect(() => validateEnv({ JWT_SECRET: 'pendek' })).toThrow(/DATABASE_URL[\s\S]*JWT_SECRET/)
  })
})
