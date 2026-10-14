import type { OfficialChannelsDto } from '@ssb/shared'
import { http } from '@/shared/lib'

export const storeApi = {
  officialChannels: () => http.get<OfficialChannelsDto>('/store/official-channels'),
}
