import 'reflect-metadata'
import { existsSync } from 'node:fs'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { setupApp } from './app.setup.js'
import { getEnv } from './config/env.js'
import { setupSwagger } from './swagger.js'

if (existsSync('.env')) process.loadEnvFile('.env')
const env = getEnv()

const app = setupApp(await NestFactory.create(AppModule), { trustProxy: env.TRUST_PROXY })
// Daftar endpoint tidak dibuka di production
if (env.NODE_ENV !== 'production') setupSwagger(app)
await app.listen(env.PORT)
