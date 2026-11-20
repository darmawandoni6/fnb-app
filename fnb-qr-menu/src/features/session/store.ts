import { useCallback, useSyncExternalStore } from 'react'

import { SESSION_STORAGE_KEY, SESSION_VERSION } from '@/constants/storage'
import type { OrderStatusResponse } from '@/types/order'

export type CartLine = {
  menuId: string
  qty: number
  note: string
}

export type TrackedOrder = {
  id: string
  trackingToken: string
  snapshot: OrderStatusResponse
}

export type CustomerSession = {
  v: typeof SESSION_VERSION
  qr: string
  cart: CartLine[]
  orders: TrackedOrder[]
  browseOnly: boolean
  invalidTable: string | null
  updatedAt: string
}

export const EMPTY_SESSION: CustomerSession = {
  v: SESSION_VERSION,
  qr: '',
  cart: [],
  orders: [],
  browseOnly: false,
  invalidTable: null,
  updatedAt: '',
}

let flashMessage: string | null = null

export function setFlash(message: string) {
  flashMessage = message
}

export function takeFlash(): string | null {
  const message = flashMessage
  flashMessage = null
  return message
}

export const setNotice = setFlash
export const takeNotice = takeFlash

let cache: { raw: string | null; value: CustomerSession } | null = null
const listeners = new Set<() => void>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCartLine(value: unknown): value is CartLine {
  return (
    isRecord(value) &&
    typeof value.menuId === 'string' &&
    typeof value.qty === 'number' &&
    typeof value.note === 'string'
  )
}

function isTrackedOrder(value: unknown): value is TrackedOrder {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.trackingToken === 'string' &&
    isRecord(value.snapshot)
  )
}

function isCustomerSession(value: unknown): value is CustomerSession {
  return (
    isRecord(value) &&
    value.v === SESSION_VERSION &&
    typeof value.qr === 'string' &&
    Array.isArray(value.cart) &&
    value.cart.every(isCartLine) &&
    Array.isArray(value.orders) &&
    value.orders.every(isTrackedOrder) &&
    typeof value.browseOnly === 'boolean' &&
    (value.invalidTable === null || typeof value.invalidTable === 'string') &&
    typeof value.updatedAt === 'string'
  )
}

function read(): CustomerSession {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(SESSION_STORAGE_KEY)
  } catch {
    // Storage blocked or unavailable: fall back to memory
  }

  if (cache && cache.raw === raw) {
    return cache.value
  }

  let value = EMPTY_SESSION
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (isCustomerSession(parsed)) {
      value = parsed
    }
  } catch {
    // Corrupt JSON or invalid: starts empty
  }

  cache = { raw, value }
  return value
}

function write(next: CustomerSession) {
  const current = read()
  let valueToWrite = next

  // Reset semantics: a different qr than the stored one clears cart and orders
  if (current.qr !== '' && next.qr !== current.qr) {
    valueToWrite = {
      ...next,
      cart: [],
      orders: [],
      browseOnly: false,
    }
    setFlash('Sesi pesanan baru dimulai')
  }

  const value = { ...valueToWrite, updatedAt: new Date().toISOString() }
  let raw: string | null = null
  try {
    raw = JSON.stringify(value)
    localStorage.setItem(SESSION_STORAGE_KEY, raw)
  } catch {
    // Storage blocked or quota exceeded: keep in memory
  }

  cache = { raw, value }
  listeners.forEach((listener) => listener())
}

export function getSession(): CustomerSession {
  return read()
}

export function updateSession(updater: (prev: CustomerSession) => CustomerSession) {
  write(updater(read()))
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  function handleStorage(event: StorageEvent) {
    if (event.key !== SESSION_STORAGE_KEY) return
    cache = null
    listener()
  }

  window.addEventListener('storage', handleStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', handleStorage)
  }
}

export function useCustomerSession() {
  const session = useSyncExternalStore(subscribe, read, () => EMPTY_SESSION)
  const update = useCallback((updater: (prev: CustomerSession) => CustomerSession) => {
    updateSession(updater)
  }, [])
  return [session, update] as const
}
