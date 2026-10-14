import type { ChatMessageDto, ChatReplyDto, PublicFaqDto } from '@ssb/shared'
import { http } from '@/shared/lib'

export const chatApi = {
  send: (messages: ChatMessageDto[]) => http.post<ChatReplyDto>('/chat', { messages }),
  faqs: () => http.get<PublicFaqDto[]>('/chat/faqs'),
}
