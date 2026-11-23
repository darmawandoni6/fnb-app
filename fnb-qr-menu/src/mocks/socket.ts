import type { SessionEvent } from '@/api/socket'

export function subscribeSessionEvents(
  _sessionToken: string,
  _onEvent: (event: SessionEvent) => void,
): () => void {
  // Mocks have no push channel; the 5-second poll is the only source.
  return () => {}
}
