import { useState } from 'react'

import { Link, Navigate, useNavigate } from 'react-router-dom'

import { ChevronLeft, Plus } from 'lucide-react'

import { ROUTES } from '@/constants/routes'

import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui/button'
import { usePublicMenu } from '@/features/catalog/hooks'
import { OrderCard } from '@/features/orders/components/OrderCard'
import { useCustomerSession } from '@/features/session/store'

import { useOrderList, useOrderRealtime } from '../status'

export function StatusPage() {
  const [session, updateSession] = useCustomerSession()
  const [selectedId, setSelectedId] = useState<string | null>(() => session.orders[0]?.id ?? null)
  const navigate = useNavigate()
  const { data: menuData } = usePublicMenu(session.sessionToken)
  const orders = useOrderList(Boolean(session.sessionToken))
  useOrderRealtime(session.orders.length > 0)

  if (!session.sessionToken || (orders.isPending && session.orders.length === 0)) {
    return null
  }

  if (session.orders.length === 0) {
    return <Navigate to={ROUTES.HOME} replace />
  }

  const activeId = session.orders.some((order) => order.id === selectedId)
    ? selectedId
    : session.orders[0].id

  function handleAddOrder() {
    updateSession((prev) => ({ ...prev, cart: [] }))
    navigate(ROUTES.HOME)
  }

  return (
    <AppShell
      cafeName={menuData?.cafeName}
      leading={
        <Link
          to={ROUTES.HOME}
          aria-label="Kembali"
          className="text-text-muted hover:text-text -ml-2 flex size-11 shrink-0 items-center justify-center rounded-full transition-colors"
        >
          <ChevronLeft className="size-5" />
        </Link>
      }
    >
      <div className="flex flex-col gap-4 pb-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-editorial text-text text-xl font-bold">Status Pesanan</h1>
            <p className="text-text-muted mt-1 text-xs">Pesanan terbaru tampil paling atas.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0 rounded-full"
            onClick={handleAddOrder}
          >
            <Plus className="size-4" />
            Tambah pesanan
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {session.orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              open={order.id === activeId}
              onToggle={() => setSelectedId(order.id)}
            />
          ))}
        </div>
      </div>
    </AppShell>
  )
}
