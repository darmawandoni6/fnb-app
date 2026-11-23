import type { PublicMenu } from '@/types/menu'

import { request } from './client'
import { toPublicMenu } from './mappers'
import type { RawMenu } from './mappers'

export async function getPublicMenu(sessionToken: string): Promise<PublicMenu> {
  const raw = await request<RawMenu>({ method: 'GET', url: '/public/menu' }, sessionToken)
  return toPublicMenu(raw)
}
