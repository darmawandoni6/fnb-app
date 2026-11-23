export type SessionEvent = {
  topic: string
  event: string
  data: unknown
}

const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 30_000]

export function sessionSocketUrl(sessionToken: string): string {
  const base = import.meta.env.VITE_API_URL || window.location.origin
  const url = new URL('/ws', base)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set('session', sessionToken)
  return url.toString()
}

export function subscribeSessionEvents(
  sessionToken: string,
  onEvent: (event: SessionEvent) => void,
): () => void {
  let socket: WebSocket | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let attempt = 0
  let stopped = false

  function stop() {
    stopped = true
    clearTimeout(retryTimer)
    socket?.close()
    socket = null
  }

  function connect() {
    if (stopped) return

    socket = new WebSocket(sessionSocketUrl(sessionToken))

    socket.onopen = () => {
      attempt = 0
      socket?.send(JSON.stringify({ action: 'subscribe', topic: `session:${sessionToken}` }))
    }

    socket.onmessage = (message) => {
      let event: SessionEvent
      try {
        event = JSON.parse(String(message.data)) as SessionEvent
      } catch {
        return
      }
      onEvent(event)
      if (event.event === 'session.closed') stop()
    }

    socket.onerror = () => socket?.close()

    socket.onclose = () => {
      if (stopped) return
      const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]
      attempt += 1
      retryTimer = setTimeout(connect, delay)
    }
  }

  connect()
  return stop
}
