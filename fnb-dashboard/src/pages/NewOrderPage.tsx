import { useState } from 'react'

import { useNavigate } from 'react-router-dom'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import type { Menu } from '@/types'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { ROUTES } from '@/constants/routes'

import { Button } from '@/components/ui/button'
import { MenuCatalogGrid } from '@/features/manual-order/MenuCatalogGrid'
import { type CartItem, OrderCartPanel } from '@/features/manual-order/OrderCartPanel'
import { manualOrderSchema } from '@/features/manual-order/manualOrderSchema'

export function NewOrderPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [cart, setCart] = useState<Record<string, CartItem>>({})
  const [customerName, setCustomerName] = useState<string>('')
  const [customerPhone, setCustomerPhone] = useState<string>('')

  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['menu-categories'],
    queryFn: api.getMenuCategories,
  })

  const {
    data: settings,
    refetch: refetchSettings,
    isFetching: isCheckingStore,
  } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    refetchInterval: 10_000,
  })

  const checkStoreStatus = async () => {
    const result = await refetchSettings()
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    toast.success(
      result.data?.is_open ? 'Toko sudah buka. Pesanan bisa dibuat.' : 'Toko masih tutup.',
    )
  }

  const isStoreClosed = settings ? !settings.is_open : false
  const serviceRate = settings?.service_rate ?? 0
  const taxRate = settings?.tax_rate ?? 0

  const cartItemCounts = Object.entries(cart).reduce(
    (acc, [menuId, item]) => {
      acc[menuId] = item.qty
      return acc
    },
    {} as Record<string, number>,
  )

  const handleAddMenu = (menu: Menu) => {
    setCart((prev) => {
      const existing = prev[menu.id]
      if (existing) {
        return {
          ...prev,
          [menu.id]: { ...existing, qty: existing.qty + 1 },
        }
      }
      return {
        ...prev,
        [menu.id]: {
          menu,
          qty: 1,
          note: '',
        },
      }
    })
  }

  const handleResetCart = () => {
    setCart({})
    setCustomerName('')
    setCustomerPhone('')
  }

  const createOrderMutation = useMutation({
    mutationFn: api.createManualOrder,
    onSuccess: (newOrder) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      toast.success(`Pesanan ${newOrder.order_number} dibuat. Melanjutkan ke pembayaran...`)
      navigate(`/orders/${newOrder.id}/payment`)
    },
    onError: (error) => {
      toast.error((error as { message?: string }).message ?? 'Gagal membuat pesanan')
    },
  })

  const handleSubmitOrder = () => {
    const rawItems = Object.entries(cart)
      .filter(([, item]) => item.qty > 0)
      .map(([menu_id, item]) => ({
        menu_id,
        qty: item.qty,
        note: item.note.trim() ? item.note.trim() : null,
      }))

    const validation = manualOrderSchema.safeParse({
      customer_name: customerName,
      customer_phone: customerPhone,
      items: rawItems,
    })

    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? 'Mohon periksa data pesanan Anda')
      return
    }

    createOrderMutation.mutate({
      items: rawItems,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim() || null,
    })
  }

  return (
    <div className="space-y-4">
      {/* Top Bar Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate(ROUTES.ORDERS)}
            className="text-muted-foreground hover:text-foreground h-8 gap-1.5 px-2 text-xs"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Orders</span>
          </Button>
          <div className="bg-border h-4 w-px" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">Buat Pesanan Baru (POS)</h1>
            <p className="text-muted-foreground text-xs">
              Pesanan take away. Pilih menu lalu lanjut ke pembayaran.
            </p>
          </div>
        </div>
        {isStoreClosed && (
          <div className="flex items-center gap-2">
            <span className="text-destructive text-xs font-semibold">Toko sedang tutup.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isCheckingStore}
              onClick={() => void checkStoreStatus()}
            >
              {isCheckingStore ? 'Memuat...' : 'Cek Status Toko'}
            </Button>
          </div>
        )}
      </div>

      {/* Main 2-Column POS Layout */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left: Menu Catalog Grid */}
        <div className="lg:col-span-7 xl:col-span-8">
          <MenuCatalogGrid
            categories={categories}
            isLoading={isLoadingCategories}
            cartItemCounts={cartItemCounts}
            onAddMenu={handleAddMenu}
            disabled={isStoreClosed}
          />
        </div>

        {/* Right: Order Cart Panel (Sticky) */}
        <div className="lg:sticky lg:top-4 lg:col-span-5 xl:col-span-4">
          <OrderCartPanel
            cart={cart}
            customerName={customerName}
            customerPhone={customerPhone}
            serviceRate={serviceRate}
            taxRate={taxRate}
            isStoreClosed={isStoreClosed}
            isSubmitting={createOrderMutation.isPending}
            onUpdateCart={setCart}
            onSetCustomerName={setCustomerName}
            onSetCustomerPhone={setCustomerPhone}
            onResetCart={handleResetCart}
            onSubmitOrder={handleSubmitOrder}
          />
        </div>
      </div>
    </div>
  )
}
