import { useEffect, useRef, useState } from 'react'

import { Timer } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

const remainingSeconds = (createdAt: string, timeoutMinutes: number) =>
  Math.floor(
    Math.max(0, new Date(createdAt).getTime() / 1000 + timeoutMinutes * 60 - Date.now() / 1000),
  )

const formatRemaining = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

/**
 * PRD §4.3 / BR-03: display the remaining cash window derived from `created_at` and
 * `settings.cash_timeout_minutes`. The scheduler on the server performs the cancellation;
 * `onExpire` only lets the caller refetch once the window is gone.
 */
export function CashCountdown({
  createdAt,
  timeoutMinutes,
  onExpire,
}: {
  createdAt: string
  timeoutMinutes: number
  onExpire?: () => void
}) {
  const [remaining, setRemaining] = useState(() => remainingSeconds(createdAt, timeoutMinutes))
  const expiredRef = useRef(false)

  useEffect(() => {
    const tick = () => setRemaining(remainingSeconds(createdAt, timeoutMinutes))
    tick()
    const id = window.setInterval(tick, 1_000)
    return () => window.clearInterval(id)
  }, [createdAt, timeoutMinutes])

  useEffect(() => {
    if (remaining > 0) {
      expiredRef.current = false
      return
    }
    if (expiredRef.current) return
    expiredRef.current = true
    onExpire?.()
  }, [remaining, onExpire])

  const expired = remaining === 0
  return (
    <Badge variant={expired ? 'destructive' : 'secondary'} className="gap-1 font-mono">
      <Timer className="size-3" />
      {expired ? 'Waktu habis' : formatRemaining(remaining)}
    </Badge>
  )
}
