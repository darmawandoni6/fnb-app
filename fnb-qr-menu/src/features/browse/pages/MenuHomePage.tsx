import { useEffect, useMemo, useState } from 'react'

import { Link, Navigate, useNavigate } from 'react-router-dom'

import { AlertTriangle, Info, Receipt, UtensilsCrossed } from 'lucide-react'
import { toast } from 'sonner'

import { API_ERROR } from '@/constants/errors'
import { ROUTES } from '@/constants/routes'
import type { MenuItem } from '@/types/menu'

import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { addToCart, qtyOf } from '@/features/browse/cart'
import { CartBar } from '@/features/browse/components/CartBar'
import { CategoryTabs } from '@/features/browse/components/CategoryTabs'
import { MenuItemCard } from '@/features/browse/components/MenuItemCard'
import { SearchField } from '@/features/browse/components/SearchField'
import { browseState, patchBrowseState } from '@/features/browse/state'
import { useTableSession } from '@/features/browse/useTableSession'
import { usePublicMenu } from '@/features/catalog/hooks'
import { unfinishedOrderCount } from '@/features/orders/status'
import { takeFlash, useCustomerSession } from '@/features/session/store'

export function MenuHomePage() {
  const { qr, sessionToken, isOpening, invalid } = useTableSession()
  const [session, updateSession] = useCustomerSession()
  const navigate = useNavigate()

  const [selectedCategory, setSelectedCategory] = useState(browseState.cat)
  const [searchQuery, setSearchQuery] = useState(browseState.q)

  const { data: menuData, isLoading, isError, error, refetch } = usePublicMenu(sessionToken)

  // One-off flash/notice (e.g. new table session notice)
  useEffect(() => {
    const flash = takeFlash()
    if (flash) {
      toast.info(flash)
    }
  }, [])

  function handleCategoryChange(id: string) {
    patchBrowseState({ cat: id })
    setSelectedCategory(id)
  }

  function handleSearchChange(q: string) {
    patchBrowseState({ q })
    setSearchQuery(q)
  }

  function handleClearSearch() {
    patchBrowseState({ q: '' })
    setSearchQuery('')
  }

  function handleQuickAdd(menu: MenuItem) {
    updateSession((prev) => {
      const nextCart = [...prev.cart]
      addToCart(nextCart, menu.id, 1, '')
      return { ...prev, cart: nextCart }
    })
    toast.success(`${menu.name} ditambahkan ke keranjang`)
  }

  // Filter categories and items
  const filteredCategories = useMemo(() => {
    if (!menuData) return []

    const q = searchQuery.trim().toLowerCase()

    return menuData.categories
      .filter((cat) => selectedCategory === 'all' || cat.id === selectedCategory)
      .map((cat) => {
        if (!q) return cat
        return {
          ...cat,
          menus: cat.menus.filter((m) => m.name.toLowerCase().includes(q)),
        }
      })
      .filter((cat) => cat.menus.length > 0)
  }, [menuData, selectedCategory, searchQuery])

  if ((invalid || !qr) && !isOpening) {
    return <Navigate to={ROUTES.INVALID} replace />
  }

  // Guard: 404 NOT_FOUND table
  if (isError && error) {
    const err = error as { status?: number; code?: string; response?: { status?: number } }
    const isNotFound =
      err.status === 404 || err.response?.status === 404 || err.code === API_ERROR.NOT_FOUND
    if (isNotFound) {
      return <Navigate to={ROUTES.INVALID} replace />
    }
  }

  // Guard: Closed store and not browseOnly
  if (menuData && !menuData.isOpen && !session.browseOnly) {
    return <Navigate to={ROUTES.CLOSED} replace />
  }

  const isBlocked = Boolean(menuData && (!menuData.isOpen || session.browseOnly))
  const totalCartCount = session.cart.reduce((sum, item) => sum + item.qty, 0)

  const totalVisibleMenus = filteredCategories.reduce((sum, cat) => sum + cat.menus.length, 0)

  const unfinished = unfinishedOrderCount(session.orders)

  return (
    <AppShell
      cafeName={menuData?.cafeName}
      trailing={
        session.orders.length > 0 ? (
          <Link
            to={ROUTES.STATUS}
            aria-label={unfinished > 0 ? `Pesanan, ${unfinished} belum selesai` : 'Pesanan'}
            className="text-text-muted hover:text-text relative flex size-11 items-center justify-center rounded-full transition-colors"
          >
            <Receipt className="size-5" />
            {unfinished > 0 && (
              <span
                aria-hidden
                className="bg-accent absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
              >
                {unfinished}
              </span>
            )}
          </Link>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4 pb-24">
        {/* Step 12: Closed Banner */}
        {session.browseOnly && (
          <div className="bg-warning/10 border-warning/30 text-text flex items-start gap-2.5 rounded-xl border p-3.5 text-xs">
            <Info className="text-warning size-4 shrink-0 translate-y-0.5" />
            <div>
              <p className="font-semibold">Kafe Sedang Tutup</p>
              <p className="text-text-muted mt-0.5">
                Anda berada dalam mode lihat menu. Pemesanan saat ini dinonaktifkan.
              </p>
            </div>
          </div>
        )}

        {/* Step 13: Loading skeleton state */}
        {(isLoading || isOpening) && (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full rounded-full" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
          </div>
        )}

        {/* Step 13: Error state */}
        {!isLoading && !isOpening && isError && (
          <div className="border-border bg-surface flex flex-col items-center justify-center rounded-2xl border p-8 text-center">
            <AlertTriangle className="text-destructive mb-3 size-10" />
            <h2 className="font-editorial text-text text-lg font-bold">Gagal Memuat Menu</h2>
            <p className="text-text-muted mt-1 max-w-xs text-xs">
              Terjadi kesalahan saat memuat menu kafe. Silakan periksa koneksi Anda dan coba lagi.
            </p>
            <Button onClick={() => refetch()} className="mt-4" size="sm">
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Menu content */}
        {!isLoading && !isOpening && !isError && menuData && (
          <>
            {/* Step 9: Search */}
            <SearchField
              value={searchQuery}
              onChange={handleSearchChange}
              onClear={handleClearSearch}
            />

            {/* Step 9: Category tabs */}
            <CategoryTabs
              categories={menuData.categories}
              selectedCategory={selectedCategory}
              onSelectCategory={handleCategoryChange}
            />

            {/* Empty state: No categories at all in store */}
            {menuData.categories.length === 0 && (
              <Empty className="py-12">
                <EmptyHeader>
                  <UtensilsCrossed className="text-text-muted size-8" />
                  <EmptyTitle>Belum Ada Menu</EmptyTitle>
                  <EmptyDescription>
                    Saat ini belum ada menu yang tersedia di kafe ini.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}

            {/* Empty search results */}
            {menuData.categories.length > 0 && totalVisibleMenus === 0 && (
              <Empty className="py-12">
                <EmptyHeader>
                  <UtensilsCrossed className="text-text-muted size-8" />
                  <EmptyTitle>Menu Tidak Ditemukan</EmptyTitle>
                  <EmptyDescription>
                    Tidak ada menu yang sesuai dengan pencarian &ldquo;{searchQuery}&rdquo;.
                  </EmptyDescription>
                </EmptyHeader>
                <Button variant="outline" size="sm" onClick={handleClearSearch} className="mt-2">
                  Hapus Pencarian
                </Button>
              </Empty>
            )}

            {/* Menu List */}
            {filteredCategories.map((category) => (
              <section key={category.id} className="flex flex-col gap-3">
                <h2 className="font-editorial text-text text-base font-semibold">
                  {category.name}
                </h2>
                <div className="flex flex-col gap-2.5">
                  {category.menus.map((menu) => (
                    <MenuItemCard
                      key={menu.id}
                      menu={menu}
                      qtyInCart={qtyOf(session.cart, menu.id)}
                      blocked={isBlocked}
                      onClick={() => navigate(`/menu/${menu.id}`)}
                      onQuickAdd={() => handleQuickAdd(menu)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>

      {/* Step 11: Sticky Cart Bar */}
      <CartBar itemCount={totalCartCount} />
    </AppShell>
  )
}
