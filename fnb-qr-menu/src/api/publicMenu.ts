import { notImplemented } from '@/api/notImplemented'
import type { PublicMenu } from '@/types/menu'

export async function getPublicMenu(_sessionToken: string): Promise<PublicMenu> {
  notImplemented('GET /public/menu')
}
