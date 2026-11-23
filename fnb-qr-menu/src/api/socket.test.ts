import { afterEach, expect, test, vi } from 'vitest'

import { subscribeSessionEvents } from './socket'

type Listener = (() => void) | null

class FakeSocket {
  static instances: FakeSocket[] = []

  onopen: Listener = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: Listener = null
  onclose: Listener = null
  sent: string[] = []
  closed = false
  url: string

  constructor(url: string) {
    this.url = url
    FakeSocket.instances.push(this)
  }

  send(payload: string) {
    this.sent.push(payload)
  }

  close() {
    this.closed = true
    this.onclose?.()
  }
}

afterEach(() => {
  FakeSocket.instances = []
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('subscribes to the session topic and backs off after a drop', () => {
  vi.useFakeTimers()
  vi.stubGlobal('WebSocket', FakeSocket)

  const stop = subscribeSessionEvents('tok', () => {})
  const first = FakeSocket.instances[0]

  first.onopen?.()
  expect(JSON.parse(first.sent[0])).toEqual({ action: 'subscribe', topic: 'session:tok' })

  first.onclose?.()
  vi.advanceTimersByTime(999)
  expect(FakeSocket.instances).toHaveLength(1)
  vi.advanceTimersByTime(1)
  expect(FakeSocket.instances).toHaveLength(2)

  FakeSocket.instances[1].onclose?.()
  vi.advanceTimersByTime(2_000)
  expect(FakeSocket.instances).toHaveLength(3)

  stop()
})

test('cleanup stops reconnects and ignores a late close', () => {
  vi.useFakeTimers()
  vi.stubGlobal('WebSocket', FakeSocket)

  const stop = subscribeSessionEvents('tok', () => {})
  const first = FakeSocket.instances[0]
  stop()

  first.onclose?.()
  vi.advanceTimersByTime(30_000)
  expect(FakeSocket.instances).toHaveLength(1)
  expect(first.closed).toBe(true)
})

test('session.closed delivers once and stops reconnecting', () => {
  vi.useFakeTimers()
  vi.stubGlobal('WebSocket', FakeSocket)

  const events: string[] = []
  subscribeSessionEvents('tok', (event) => events.push(event.event))
  const first = FakeSocket.instances[0]

  first.onmessage?.({ data: JSON.stringify({ topic: 'session:tok', event: 'session.closed' }) })
  vi.advanceTimersByTime(30_000)

  expect(events).toEqual(['session.closed'])
  expect(FakeSocket.instances).toHaveLength(1)
})
