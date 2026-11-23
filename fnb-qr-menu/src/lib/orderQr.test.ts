import { describe, expect, it } from 'vitest'

import { DASHBOARD_URL, getOrderQrUrl, hasDashboardUrl } from './orderQr'

describe('orderQr', () => {
  it('links to the dashboard board with the order number as a query', () => {
    expect(getOrderQrUrl('DI-20261121-001')).toBe(`${DASHBOARD_URL}/orders?q=DI-20261121-001`)
  })

  it('encodes characters that break a query string', () => {
    expect(getOrderQrUrl('A B&C')).toContain('q=A%20B%26C')
  })

  it('reports the button visibility from the configured origin', () => {
    expect(hasDashboardUrl).toBe(DASHBOARD_URL.length > 0)
    expect(DASHBOARD_URL.endsWith('/')).toBe(false)
  })
})
