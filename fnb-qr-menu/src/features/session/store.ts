import { useSyncExternalStore } from 'react'

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

const EMPTY_SESSION: CustomerSession = {
  v: SESSION_VERSION,
  qr: '',
  cart: [],
  orders: [],
  browseOnly: false,
  invalidTable: null,
  updatedAt: '',
}

let cached: CustomerSession | null = null
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

function load(): CustomerSession {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (isCustomerSession(parsed)) return parsed
  } catch {
    // Storage unavailable or corrupt: fall back to an empty in-memory session.
  }
  return EMPTY_SESSION
}

function read(): CustomerSession {
  cached ??= load()
  return cached
}

function write(next: CustomerSession) {
  cached = { ...next, updatedAt: new Date().toISOString() }
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(cached))
  } catch {
    // Private mode or quota: the in-memory cache keeps the app working.
  }
  listeners.forEach((listener) => listener())
}

export function getSession() {
  return read()
}

export function updateSession(updater: (prev: CustomerSession) => CustomerSession) {
  write(updater(read()))
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  function handleStorage(event: StorageEvent) {
    if (event.key !== SESSION_STORAGE_KEY) return
    cached = load()
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
  return [session, updateSession] as const
}
