import { useEffect } from 'react'

import { useSearchParams } from 'react-router-dom'

import { useCustomerSession } from '@/features/session/store'

export function useUrlTable(): string {
  const [searchParams, setSearchParams] = useSearchParams()
  const [session, updateSession] = useCustomerSession()

  const rawMeja = searchParams.get('meja')
  const mejaFromUrl = rawMeja && rawMeja.trim() !== '' ? rawMeja.trim() : null

  useEffect(() => {
    if (mejaFromUrl) {
      if (mejaFromUrl !== session.qr) {
        updateSession((prev) => ({
          ...prev,
          qr: mejaFromUrl,
        }))
      }
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('meja')
      setSearchParams(nextParams, { replace: true })
    }
  }, [mejaFromUrl, searchParams, setSearchParams, session.qr, updateSession])

  return mejaFromUrl || session.qr
}
