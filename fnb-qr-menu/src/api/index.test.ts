import { expect, test, vi } from 'vitest'

import { API_ERROR } from '@/constants/errors'

test('resolves mock handlers when VITE_USE_MOCKS=true', async () => {
  vi.stubEnv('VITE_USE_MOCKS', 'true')
  vi.resetModules()

  const api = await import('./index')
  const opened = await api.openTableSession('demo-meja')
  const menu = await api.getPublicMenu(opened.sessionToken)

  expect(menu.isOpen).toBe(true)
})

test('throws NOT_IMPLEMENTED when VITE_USE_MOCKS is off', async () => {
  vi.stubEnv('VITE_USE_MOCKS', 'false')
  vi.resetModules()

  const api = await import('./index')

  await expect(api.getPublicMenu('demo-meja')).rejects.toMatchObject({
    code: API_ERROR.NOT_IMPLEMENTED,
  })
})
