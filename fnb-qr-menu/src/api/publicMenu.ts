import { notImplemented } from '@/api/notImplemented'
import type { PublicMenu } from '@/types/menu'

export async function getPublicMenu(_qrToken: string): Promise<PublicMenu> {
  notImplemented('GET /public/tables/:qr_token/menu')
}
