import { beforeEach, describe, expect, it } from 'vitest'

import { getSession, updateSession } from '@/features/session/store'

beforeEach(() => {
  localStorage.clear()
})

describe('table URL handling', () => {
  it('updates session qr when different from existing', () => {
    updateSession((prev) => ({ ...prev, qr: 'table-01' }))
    expect(getSession().qr).toBe('table-01')

    updateSession((prev) => ({ ...prev, qr: 'table-02' }))
    expect(getSession().qr).toBe('table-02')
  })
})
