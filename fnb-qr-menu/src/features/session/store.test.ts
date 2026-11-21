import { beforeEach, expect, test, vi } from 'vitest'

import { SESSION_STORAGE_KEY } from '@/constants/storage'

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

test('round-trips a cart line through storage', async () => {
  const { getSession, updateSession } = await import('./store')

  updateSession((prev) => ({ ...prev, cart: [{ menuId: 'menu-1', qty: 2, note: '' }] }))

  expect(getSession().cart).toEqual([{ menuId: 'menu-1', qty: 2, note: '' }])

  vi.resetModules()
  const reloaded = await import('./store')
  expect(reloaded.getSession().cart).toHaveLength(1)
})

test('starts empty on corrupt storage', async () => {
  localStorage.setItem(SESSION_STORAGE_KEY, '{not-json')

  const { getSession } = await import('./store')
  expect(getSession().cart).toEqual([])
  expect(getSession().orders).toEqual([])
})

test('starts empty on an unknown version', async () => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ v: 99, qr: 'stale' }))

  const { getSession } = await import('./store')
  expect(getSession().qr).toBe('')
})

test('two tabs stay in sync through the storage event', async () => {
  const { getSession } = await import('./store')

  // Simulate another tab updating localStorage
  const otherTabSession = {
    v: 1,
    qr: 'table-remote',
    sessionToken: 'session-remote',
    cart: [{ menuId: 'menu-remote', qty: 3, note: 'es batu' }],
    orders: [],
    browseOnly: false,
    invalidTable: null,
    updatedAt: new Date().toISOString(),
  }
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(otherTabSession))

  // Dispatch storage event like the browser would
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: SESSION_STORAGE_KEY,
      newValue: JSON.stringify(otherTabSession),
    }),
  )

  expect(getSession().qr).toBe('table-remote')
  expect(getSession().cart).toEqual([{ menuId: 'menu-remote', qty: 3, note: 'es batu' }])
})

test('writing a new qr empties cart and orders and leaves browseOnly false', async () => {
  const { getSession, updateSession, takeFlash } = await import('./store')

  // Set initial table session with cart and orders
  updateSession((prev) => ({
    ...prev,
    qr: 'table-1',
    cart: [{ menuId: 'menu-1', qty: 2, note: 'pedas' }],
    browseOnly: true,
  }))

  expect(getSession().qr).toBe('table-1')
  expect(getSession().cart).toHaveLength(1)

  // Write a different qr
  updateSession((prev) => ({
    ...prev,
    qr: 'table-2',
  }))

  const next = getSession()
  expect(next.qr).toBe('table-2')
  expect(next.cart).toEqual([])
  expect(next.orders).toEqual([])
  expect(next.browseOnly).toBe(false)
  expect(takeFlash()).toBe('Sesi pesanan baru dimulai')
  expect(takeFlash()).toBeNull()
})
