import 'reflect-metadata'
import { existsSync } from 'node:fs'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { setupApp } from './app.setup.js'
import { getEnv } from './config/env.js'

if (existsSync('.env')) process.loadEnvFile('.env')
const env = getEnv()

const app = setupApp(await NestFactory.create(AppModule), { trustProxy: env.TRUST_PROXY })
await app.listen(env.PORT)
