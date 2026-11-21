import { Link, Navigate } from 'react-router-dom'

import { ChevronLeft, Loader2, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'

import { ROUTES } from '@/constants/routes'

import { AppShell } from '@/components/AppShell'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { usePublicMenu } from '@/features/catalog/hooks'
import { CartLineRow } from '@/features/checkout/components/CartLineRow'
import { CheckoutForm } from '@/features/checkout/components/CheckoutForm'
import { useSendOrder } from '@/features/checkout/hooks'
import { useCustomerSession } from '@/features/session/store'

export function CartPage() {
  const [session] = useCustomerSession()
  const { data: menuData } = usePublicMenu(session.sessionToken)

  const { mutation, visibleLines } = useSendOrder()

  if (!session.sessionToken) {
    return <Navigate to={ROUTES.HOME} replace />
  }

  const isPending = mutation.isPending
  const isBlocked = Boolean(menuData && !menuData.isOpen)
  const allHidden = session.cart.length > 0 && visibleLines.length === 0
  const canSubmit = visibleLines.length > 0 && !isBlocked && !isPending

  function handleSubmit(input: Parameters<typeof mutation.mutate>[0]) {
    if (visibleLines.length === 0) {
      if (isBlocked) toast.error('Pemesanan dinonaktifkan saat kafe tutup')
      return
    }
    mutation.mutate(input)
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
          <>
            <div className="flex flex-col gap-3">
              {visibleLines.map((line) => (
                <CartLineRow key={line.key} line={line} disabled={isPending} />
              ))}
            </div>

            <p className="text-text-muted text-center text-xs">
              {visibleLines.length} item · total dihitung kasir
            </p>

            <CheckoutForm disabled={!canSubmit} pending={isPending} onSubmit={handleSubmit} />

            {isPending && (
              <p className="text-text-muted flex items-center justify-center gap-2 text-xs">
                <Loader2 className="size-3 animate-spin" />
                Mengirim pesanan...
              </p>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
