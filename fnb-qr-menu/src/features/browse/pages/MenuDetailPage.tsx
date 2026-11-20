import { useMemo, useState } from 'react'

import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ChevronLeft, Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { MAX_QTY, NOTE_MAX } from '@/constants/cart'
import { ROUTES } from '@/constants/routes'
import { formatRupiah } from '@/lib/formatRupiah'

import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { lineKey, saveCartLine } from '@/features/browse/cart'
import { usePublicMenu } from '@/features/catalog/hooks'
import { useCustomerSession } from '@/features/session/store'

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function MenuDetailPage() {
  const { menuId } = useParams<{ menuId: string }>()
  const [searchParams] = useSearchParams()
  const editKey = searchParams.get('edit')
  const navigate = useNavigate()

  const [session, updateSession] = useCustomerSession()
  const { data: menuData, isLoading, isError } = usePublicMenu(session.qr)

  // Find the menu item across all categories
  const menu = useMemo(() => {
    if (!menuData || !menuId) return null
    for (const cat of menuData.categories) {
      const found = cat.menus.find((m) => m.id === menuId)
      if (found) return found
    }
    return null
  }, [menuData, menuId])

  // Look for existing cart line if in edit mode
  const existingLine = useMemo(() => {
    if (!editKey || !menuId) return null
    return session.cart.find((l) => l.menuId === menuId && lineKey(l.menuId, l.note) === editKey)
  }, [editKey, menuId, session.cart])

  const [qty, setQty] = useState(() => (existingLine ? existingLine.qty : 1))
  const [note, setNote] = useState(() => (existingLine ? existingLine.note : ''))

  // Guard: if menu query finished and menu is not found, redirect to /
  if (!isLoading && !isError && (!menu || !session.qr)) {
    return <Navigate to={ROUTES.HOME} replace />
  }

  const isBlocked = Boolean(menuData && (!menuData.isOpen || session.browseOnly))

  function handleDecrement() {
    setQty((prev) => Math.max(1, prev - 1))
  }

  function handleIncrement() {
    setQty((prev) => Math.min(MAX_QTY, prev + 1))
  }

  function handleSave() {
    if (!menu || isBlocked) return

    updateSession((prev) => {
      const nextCart = [...prev.cart]
      const result = saveCartLine(nextCart, editKey, menu.id, qty, note)

      if (result === 'merged') {
        toast.success('Pesanan digabungkan dengan catatan yang sama')
      } else if (result === 'saved') {
        toast.success('Perubahan pesanan disimpan')
      } else {
        toast.success(`${menu.name} ditambahkan ke keranjang`)
      }

      return { ...prev, cart: nextCart }
    })

    if (editKey) {
      navigate(ROUTES.CART)
    } else {
      navigate(ROUTES.HOME)
    }
  }

  return (
    <AppShell cafeName={menuData?.cafeName}>
      <div className="flex flex-col gap-4 pb-12">
        {/* Back Link */}
        <div>
          <Link
            to={editKey ? ROUTES.CART : ROUTES.HOME}
            className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm font-medium transition-colors"
          >
            <ChevronLeft className="size-4" />
            <span>{editKey ? 'Kembali ke Keranjang' : 'Kembali ke Menu'}</span>
          </Link>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-6 w-28 rounded-lg" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        )}

        {/* Menu Detail Content */}
        {!isLoading && menu && (
          <div className="flex flex-col gap-5">
            {/* Hero image or initials */}
            {menu.imageUrl ? (
              <img
                src={menu.imageUrl}
                alt={menu.name}
                className="h-60 w-full rounded-2xl object-cover shadow-xs"
              />
            ) : (
              <div className="bg-surface-muted text-accent font-editorial flex h-60 w-full items-center justify-center rounded-2xl text-5xl font-bold shadow-xs">
                {getInitials(menu.name)}
              </div>
            )}

            {/* Menu Header */}
            <div>
              <h1 className="font-editorial text-text text-2xl font-bold">{menu.name}</h1>
              <p className="text-text mt-1 text-lg font-semibold">{formatRupiah(menu.price)}</p>
            </div>

            {/* Quantity Stepper */}
            <div className="border-border bg-surface flex items-center justify-between rounded-xl border p-4 shadow-xs">
              <span className="text-text text-sm font-medium">Jumlah</span>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={qty <= 1 || isBlocked}
                  onClick={handleDecrement}
                  aria-label="Kurangi jumlah"
                  className="rounded-full"
                >
                  <Minus className="size-3.5" />
                </Button>
                <span className="text-text w-8 text-center text-sm font-bold">{qty}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={qty >= MAX_QTY || isBlocked}
                  onClick={handleIncrement}
                  aria-label="Tambah jumlah"
                  className="rounded-full"
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* Note field */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="menu-note" className="text-text text-xs font-medium">
                  Catatan untuk Dapur (Opsional)
                </label>
                <span className="text-text-muted text-xs">
                  {note.length}/{NOTE_MAX}
                </span>
              </div>
              <Textarea
                id="menu-note"
                placeholder="Contoh: Kurang manis, tanpa es, tidak pedas..."
                maxLength={NOTE_MAX}
                value={note}
                disabled={isBlocked}
                onChange={(e) => setNote(e.target.value)}
                className="resize-none text-sm"
                rows={3}
              />
            </div>

            {/* Save / Add action */}
            <div className="pt-2">
              <Button
                type="button"
                className="h-12 w-full rounded-full text-base font-semibold"
                disabled={isBlocked}
                onClick={handleSave}
              >
                {isBlocked
                  ? 'Pemesanan Dinonaktifkan'
                  : editKey
                    ? 'Simpan Perubahan'
                    : 'Tambah ke Keranjang'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
