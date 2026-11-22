import { queryClient } from '@/lib/queryClient'

import { getAccessToken, onUnauthorized } from '@/auth/token'

type WSMessage = {
  topic: string
  event: string
  data: {
    id: string
    order_number: string
    status: string
    payment_status: string
    items: { id: string; status: string }[]
  }
}

type WSInbound = { action: 'subscribe' | 'unsubscribe'; topic: string }

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
const pendingSubscriptions = new Set<string>()
let isLoggedOut = false

const WS_URL = (import.meta.env.VITE_API_URL || '') + '/ws'

function connect() {
  if (ws?.readyState === WebSocket.OPEN || isLoggedOut) return

  const token = getAccessToken()
  if (!token) return

  ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`)

  ws.onopen = () => {
    pendingSubscriptions.forEach((topic) => send({ action: 'subscribe', topic }))
  }

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data) as WSMessage
      handleMessage(msg)
    } catch {
      // ignore malformed
    }
  }

  ws.onclose = () => {
    ws = null
    if (!isLoggedOut) scheduleReconnect()
  }

  ws.onerror = () => {
    // onclose will fire
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, 2000)
}

function send(msg: WSInbound) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  } else {
    pendingSubscriptions.add(msg.topic)
  }
}

function handleMessage(msg: WSMessage) {
  const { topic, data } = msg

  if (topic.startsWith('order:')) {
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['orders', data.id] })
    queryClient.invalidateQueries({ queryKey: ['order-stats'] })
  }
  if (topic.startsWith('session:')) {
    queryClient.invalidateQueries({ queryKey: ['tables'] })
    queryClient.invalidateQueries({ queryKey: ['table-session'] })
  }
}

export function subscribeOrder(orderId: string) {
  send({ action: 'subscribe', topic: `order:${orderId}` })
}

export function unsubscribeOrder(orderId: string) {
  send({ action: 'unsubscribe', topic: `order:${orderId}` })
  pendingSubscriptions.delete(`order:${orderId}`)
}

export function subscribeSession(sessionToken: string) {
  send({ action: 'subscribe', topic: `session:${sessionToken}` })
}

export function unsubscribeSession(sessionToken: string) {
  send({ action: 'unsubscribe', topic: `session:${sessionToken}` })
  pendingSubscriptions.delete(`session:${sessionToken}`)
}

export function initWS() {
  isLoggedOut = false
  connect()
  return () => {
    isLoggedOut = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    pendingSubscriptions.clear()
    ws?.close()
    ws = null
  }
}

onUnauthorized(() => {
  isLoggedOut = true
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  pendingSubscriptions.clear()
  ws?.close()
  ws = null
})
