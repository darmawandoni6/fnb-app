import { expect, test, vi } from 'vitest'

test('resolves mock handlers when VITE_USE_MOCKS=true', async () => {
  vi.stubEnv('VITE_USE_MOCKS', 'true')
  vi.resetModules()

  const api = await import('./index')
  const opened = await api.openTableSession('demo-meja')
  const menu = await api.getPublicMenu(opened.sessionToken)

  expect(menu.isOpen).toBe(true)
})
