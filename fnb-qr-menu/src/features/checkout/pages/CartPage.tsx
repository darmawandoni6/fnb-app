import { Link, Navigate } from 'react-router-dom'

import { Loader2, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'

import { ROUTES } from '@/constants/routes'

import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { usePublicMenu } from '@/features/catalog/hooks'
import { CartLineRow } from '@/features/checkout/components/CartLineRow'
import { useSendOrder } from '@/features/checkout/hooks'
import { useCustomerSession } from '@/features/session/store'

export function CartPage() {
  const [session] = useCustomerSession()
  const { data: menuData } = usePublicMenu(session.qr)

  const { mutation, visibleLines } = useSendOrder()

  // Guard: redirect to home if no qr
  if (!session.qr) {
    return <Navigate to={ROUTES.HOME} replace />
  }

  const isPending = mutation.isPending
  const isBlocked = Boolean(menuData && !menuData.isOpen)
  const allHidden = session.cart.length > 0 && visibleLines.length === 0
  const canSubmit = visibleLines.length > 0 && !isBlocked && !isPending

  function handleSubmit() {
    if (!canSubmit) {
      if (isBlocked) toast.error('Pemesanan dinonaktifkan saat kafe tutup')
      return
    }
    mutation.mutate()
  }

  return (
    <AppShell cafeName={menuData?.cafeName}>
      <div className="flex flex-col gap-4 pb-32">
        <h1 className="font-editorial text-text text-xl font-bold">Keranjang</h1>

        {/* Empty cart */}
        {session.cart.length === 0 && (
          <Empty className="py-16">
            <EmptyHeader>
              <ShoppingBag className="text-text-muted size-10" />
              <EmptyTitle>Keranjang Kosong</EmptyTitle>
              <EmptyDescription>
                Tambahkan menu dari daftar menu untuk melanjutkan.
              </EmptyDescription>
            </EmptyHeader>
            <Link
              to={ROUTES.HOME}
              className="bg-accent hover:bg-accent/90 mt-4 inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-white transition-colors"
            >
              Lihat Menu
            </Link>
          </Empty>
        )}

        {/* All lines hidden (menus disappeared) */}
        {allHidden && (
          <div className="bg-warning/10 border-warning/30 text-text rounded-xl border p-4 text-sm">
            <p className="font-semibold">Menu Tidak Tersedia</p>
            <p className="text-text-muted mt-1">
              Semua menu di keranjang Anda sudah tidak tersedia. Silakan pilih menu lain.
            </p>
            <Link
              to={ROUTES.HOME}
              className="text-accent mt-2 inline-block text-sm font-medium hover:underline"
            >
              Kembali ke menu
            </Link>
          </div>
        )}

        {/* Cart line rows */}
        {visibleLines.length > 0 && (
          <div className="flex flex-col gap-3">
            {visibleLines.map((line) => (
              <CartLineRow key={line.key} line={line} disabled={isPending} />
            ))}
          </div>
        )}
      </div>

      {/* Sticky footer */}
      {session.cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-4">
          <div className="mx-auto max-w-xl">
            <div className="bg-surface border-border rounded-2xl border p-4 shadow-lg">
              {/* Step 3: No aggregate — only item count */}
              <p className="text-text-muted mb-3 text-center text-xs">
                {visibleLines.length} item · total dihitung kasir
              </p>
              <Button
                type="button"
                className="h-12 w-full rounded-full text-base font-semibold"
                disabled={!canSubmit || allHidden}
                onClick={handleSubmit}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Mengirim Pesanan...
                  </>
                ) : isBlocked ? (
                  'Pemesanan Dinonaktifkan'
                ) : allHidden ? (
                  'Menu Sudah Tidak Tersedia'
                ) : (
                  'Pesan Sekarang'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
