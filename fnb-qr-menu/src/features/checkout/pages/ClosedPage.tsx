import { useNavigate } from 'react-router-dom'

import { Clock } from 'lucide-react'

import { ROUTES } from '@/constants/routes'

import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui/button'
import { useCustomerSession } from '@/features/session/store'

export function ClosedPage() {
  const [, updateSession] = useCustomerSession()
  const navigate = useNavigate()

  function handleBrowseOnly() {
    updateSession((prev) => ({ ...prev, browseOnly: true }))
    navigate(ROUTES.HOME)
  }

  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="bg-muted text-text-muted mb-4 flex size-14 items-center justify-center rounded-full">
          <Clock className="size-7" />
        </div>
        <h1 className="font-editorial text-text text-2xl font-bold">Kafe Sedang Tutup</h1>
        <p className="text-text-muted mt-2 max-w-xs text-sm">
          Mohon maaf, saat ini kafe belum menerima pesanan. Anda tetap dapat melihat daftar menu
          yang tersedia.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button onClick={handleBrowseOnly}>Lihat Menu Saja</Button>
        </div>
      </div>
    </AppShell>
  )
}
