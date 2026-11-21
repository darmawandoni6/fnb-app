import { useEffect, useRef, useState } from 'react'

import { useSearchParams } from 'react-router-dom'

import { openTableSession } from '@/api'

import { API_ERROR } from '@/constants/errors'
import { isApiError } from '@/lib/apiError'

import { useCustomerSession } from '@/features/session/store'

export function useTableSession() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [session, updateSession] = useCustomerSession()
  const [invalid, setInvalid] = useState(false)
  const [failedQr, setFailedQr] = useState<string | null>(null)
  const attempted = useRef(new Set<string>())

  const mejaFromUrl = searchParams.get('meja')?.trim() ?? ''
  const qr = mejaFromUrl || session.qr
  const isReady = qr !== '' && session.qr === qr && session.sessionToken !== ''

  useEffect(() => {
    if (isReady) {
      if (searchParams.has('meja')) {
        const nextParams = new URLSearchParams(searchParams)
        nextParams.delete('meja')
        setSearchParams(nextParams, { replace: true })
      }
      return
    }

    if (!qr || attempted.current.has(qr)) return
    attempted.current.add(qr)

    void openTableSession(qr)
      .then((opened) => {
        updateSession((prev) => ({ ...prev, qr, sessionToken: opened.sessionToken }))
      })
      .catch((error: unknown) => {
        setFailedQr(qr)
        if (isApiError(error) && error.code === API_ERROR.NOT_FOUND) setInvalid(true)
      })
  }, [qr, isReady, searchParams, setSearchParams, updateSession])

  return {
    qr,
    sessionToken: session.sessionToken,
    isOpening: qr !== '' && !isReady && !invalid && failedQr !== qr,
    invalid,
  }
}
