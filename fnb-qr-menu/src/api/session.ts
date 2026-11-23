import type { OpenSessionResponse } from '@/types/order'

import { request } from './client'
import { toOpenSession } from './mappers'
import type { RawOpenSession } from './mappers'

export async function openTableSession(qrToken: string): Promise<OpenSessionResponse> {
  const raw = await request<RawOpenSession>({
    method: 'POST',
    url: `/public/tables/${encodeURIComponent(qrToken)}/sessions`,
  })
  return toOpenSession(raw)
}
