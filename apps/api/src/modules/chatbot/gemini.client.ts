import {
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from '@google/genai'
import { getEnv } from '../../config/env.js'

/** Bagian SDK Gemini yang dipakai chatbot; di test diganti model palsu lewat token ini. */
export interface ChatModel {
  generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>
}
export const CHAT_MODEL = Symbol('CHAT_MODEL')

/** null bila GEMINI_API_KEY kosong: chatbot otomatis memakai mode FAQ (ADR-0006) */
export const chatModelProvider = {
  provide: CHAT_MODEL,
  useFactory: (): ChatModel | null => {
    const key = getEnv().GEMINI_API_KEY
    return key ? new GoogleGenAI({ apiKey: key }).models : null
  },
}
