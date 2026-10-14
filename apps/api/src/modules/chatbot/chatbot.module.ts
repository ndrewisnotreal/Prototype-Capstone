import { Module } from '@nestjs/common'
import { ProductsModule } from '../products/products.module.js'
import { StoreSettingsModule } from '../store-settings/store-settings.module.js'
import { ChatbotPublicController } from './chatbot.public.controller.js'
import { ChatbotService } from './chatbot.service.js'
import { chatModelProvider } from './gemini.client.js'

@Module({
  imports: [ProductsModule, StoreSettingsModule],
  controllers: [ChatbotPublicController],
  providers: [ChatbotService, chatModelProvider],
})
export class ChatbotModule {}
