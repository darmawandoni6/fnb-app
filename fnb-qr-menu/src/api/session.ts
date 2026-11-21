import { notImplemented } from '@/api/notImplemented'
import type { OpenSessionResponse } from '@/types/order'

export async function openTableSession(_qrToken: string): Promise<OpenSessionResponse> {
  notImplemented('POST /public/tables/:qr_token/sessions')
}
