import { useState } from 'react'

import type { Menu } from '@/types'
import { Clock, FolderDown, Minus, Plus, ShoppingBag, Trash2, User } from 'lucide-react'
import { toast } from 'sonner'

import { formatRupiah, formatTime } from '@/lib/format'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { type PosDraftOrder, usePosDrafts } from './usePosDrafts'

export type CartItem = {
  menu: Menu
  qty: number
  note: string
}

type OrderCartPanelProps = {
  cart: Record<string, CartItem>
  customerName: string
  customerPhone: string
  serviceRate: number
  taxRate: number
  isStoreClosed: boolean
  isSubmitting: boolean
  onUpdateCart: (updater: (prev: Record<string, CartItem>) => Record<string, CartItem>) => void
  onSetCustomerName: (name: string) => void
  onSetCustomerPhone: (phone: string) => void
  onResetCart: () => void
  onSubmitOrder: () => void
}

export function OrderCartPanel({
  cart,
  customerName,
  customerPhone,
  serviceRate,
  taxRate,
  isStoreClosed,
  isSubmitting,
  onUpdateCart,
  onSetCustomerName,
  onSetCustomerPhone,
  onResetCart,
  onSubmitOrder,
}: OrderCartPanelProps) {
  const { drafts, saveDraft, deleteDraft } = usePosDrafts()
  const [draftDialogOpen, setDraftDialogOpen] = useState(false)

  const cartItemsList = Object.values(cart).filter((item) => item.qty > 0)
  const totalItemCount = cartItemsList.reduce((sum, item) => sum + item.qty, 0)

  const subtotal = cartItemsList.reduce((sum, item) => sum + item.qty * item.menu.price, 0)
  const serviceAmount = Math.round((subtotal * serviceRate) / 100)
  const taxAmount = Math.round(((subtotal + serviceAmount) * taxRate) / 100)
  const grandTotal = subtotal + serviceAmount + taxAmount

  const handleHoldDraft = () => {
    if (cartItemsList.length === 0) {
      toast.error('Keranjang masih kosong, tidak ada pesanan untuk disimpan')
      return
    }

    const name =
      customerName.trim() ||
      `Pelanggan-${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`

    const serializedItems: Record<string, { qty: number; note: string }> = {}
    for (const [menuId, item] of Object.entries(cart)) {
      if (item.qty > 0) {
        serializedItems[menuId] = { qty: item.qty, note: item.note }
      }
    }

    saveDraft({
      customer_name: name,
      items: serializedItems,
      item_count: totalItemCount,
      total_estimate: grandTotal,
    })

    toast.success(`Pesanan a/n "${name}" berhasil ditahan/disimpan ke draft`)
    onResetCart()
  }

  const handleResumeDraft = (draft: PosDraftOrder, allMenus: Menu[]) => {
    const newCart: Record<string, CartItem> = {}
    for (const [menuId, draftItem] of Object.entries(draft.items)) {
      const menu = allMenus.find((m) => m.id === menuId)
      if (menu) {
        newCart[menuId] = {
          menu,
          qty: draftItem.qty,
          note: draftItem.note,
        }
      }
    }

    onUpdateCart(() => newCart)
    onSetCustomerName(draft.customer_name)

    deleteDraft(draft.id)
    setDraftDialogOpen(false)
    toast.success(`Draft pesanan "${draft.customer_name}" dimuat kembali ke keranjang`)
  }

  const handleIncrement = (menuId: string) => {
    onUpdateCart((prev) => {
      const existing = prev[menuId]
      if (!existing) return prev
      return {
        ...prev,
        [menuId]: { ...existing, qty: existing.qty + 1 },
      }
    })
  }

  const handleDecrement = (menuId: string) => {
    onUpdateCart((prev) => {
      const existing = prev[menuId]
      if (!existing) return prev
      if (existing.qty <= 1) {
        const next = { ...prev }
        delete next[menuId]
        return next
      }
      return {
        ...prev,
        [menuId]: { ...existing, qty: existing.qty - 1 },
      }
    })
  }

  const handleRemove = (menuId: string) => {
    onUpdateCart((prev) => {
      const next = { ...prev }
      delete next[menuId]
      return next
    })
  }

  const handleNoteChange = (menuId: string, note: string) => {
    onUpdateCart((prev) => {
      const existing = prev[menuId]
      if (!existing) return prev
      return {
        ...prev,
        [menuId]: { ...existing, note },
      }
    })
  }

  return (
    <Card className="flex flex-col border shadow-sm">
      {/* Panel Header */}
      <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-bold">Pesanan</CardTitle>
          <Badge variant="secondary" className="text-xs">
            Take Away
          </Badge>
          {totalItemCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {totalItemCount} item
            </Badge>
          )}
        </div>

        {/* Drafts Manager & Reset Buttons */}
        <div className="flex items-center gap-1.5">
          <Dialog open={draftDialogOpen} onOpenChange={setDraftDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs">
                <FolderDown className="h-3.5 w-3.5" />
                <span>Draft</span>
                {drafts.length > 0 && (
                  <Badge variant="destructive" className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
                    {drafts.length}
                  </Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Draft Pesanan Tersimpan (Park Order)</DialogTitle>
                <DialogDescription>
                  Daftar pesanan yang sedang ditahan untuk melayani pelanggan lain.
                </DialogDescription>
              </DialogHeader>

              {drafts.length === 0 ? (
                <div className="text-muted-foreground flex h-32 flex-col items-center justify-center text-sm">
                  Belum ada pesanan yang ditahan
                </div>
              ) : (
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {drafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="flex items-center justify-between rounded-lg border p-3 text-xs"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{draft.customer_name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            Take Away
                          </Badge>
                        </div>
                        <span className="text-muted-foreground">
                          {draft.item_count} item · Total: {formatRupiah(draft.total_estimate)}
                        </span>
                        <span className="text-muted-foreground/80 flex items-center gap-1 text-[10px]">
                          <Clock className="h-2.5 w-2.5" />
                          {formatTime(draft.created_at)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            const allMenus = cartItemsList.map((i) => i.menu)
                            handleResumeDraft(draft, allMenus)
                          }}
                        >
                          Muat
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive h-7 w-7"
                          onClick={() => deleteDraft(draft.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {cartItemsList.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResetCart}
              className="text-muted-foreground hover:text-destructive h-8 text-xs"
            >
              Reset
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 p-4">
        {/* Customer Inputs */}
        <div className="flex flex-col gap-2.5">
          <div>
            <Label htmlFor="customer-name" className="mb-1 block text-xs font-semibold">
              Nama Pelanggan <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <User className="text-muted-foreground absolute top-2.5 left-2.5 h-3.5 w-3.5" />
              <Input
                id="customer-name"
                placeholder="Contoh: Budi Santoso"
                value={customerName}
                onChange={(e) => onSetCustomerName(e.target.value)}
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="customer-phone" className="mb-1 block text-xs font-semibold">
              No. HP (opsional)
            </Label>
            <Input
              id="customer-phone"
              inputMode="tel"
              placeholder="08xxxxxxxxxx"
              value={customerPhone}
              onChange={(e) => onSetCustomerPhone(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1">
          <Label className="text-muted-foreground mb-2 block text-xs font-semibold">
            Daftar Menu Dipilih
          </Label>

          {cartItemsList.length === 0 ? (
            <div className="text-muted-foreground flex h-44 flex-col items-center justify-center rounded-lg border border-dashed text-center">
              <ShoppingBag className="text-muted-foreground/60 mb-2 h-7 w-7 stroke-1" />
              <p className="text-xs font-medium">Keranjang masih kosong</p>
              <p className="text-[11px]">Klik menu di katalog samping untuk menambahkan</p>
            </div>
          ) : (
            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              {cartItemsList.map(({ menu, qty, note }) => (
                <div
                  key={menu.id}
                  className="bg-card flex flex-col gap-1.5 rounded-lg border p-2.5 text-xs shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground line-clamp-1 font-semibold">{menu.name}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {formatRupiah(menu.price)} / porsi
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground text-xs font-bold">
                        {formatRupiah(qty * menu.price)}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemove(menu.id)}
                        className="text-muted-foreground hover:text-destructive h-6 w-6"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Input
                      placeholder="Catatan menu (opsional)..."
                      value={note}
                      onChange={(e) => handleNoteChange(menu.id, e.target.value)}
                      className="h-7 flex-1 text-[11px]"
                    />

                    {/* Qty Counter Buttons */}
                    <div className="bg-background flex items-center gap-1 rounded-md border p-0.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDecrement(menu.id)}
                        className="h-5 w-5 rounded-xs"
                      >
                        <Minus className="h-2.5 w-2.5" />
                      </Button>
                      <span className="w-5 text-center text-xs font-bold">{qty}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleIncrement(menu.id)}
                        className="h-5 w-5 rounded-xs"
                      >
                        <Plus className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bill Calculations */}
        <div className="bg-muted/50 space-y-1.5 rounded-lg p-3 text-xs">
          <div className="text-muted-foreground flex justify-between">
            <span>Subtotal</span>
            <span>{formatRupiah(subtotal)}</span>
          </div>
          <div className="text-muted-foreground flex justify-between">
            <span>Service ({serviceRate}%)</span>
            <span>{formatRupiah(serviceAmount)}</span>
          </div>
          <div className="text-muted-foreground flex justify-between">
            <span>Pajak ({taxRate}%)</span>
            <span>{formatRupiah(taxAmount)}</span>
          </div>
          <div className="text-foreground flex justify-between border-t pt-1.5 text-sm font-bold">
            <span>Total Tagihan</span>
            <span className="text-emerald-600 dark:text-emerald-400">
              {formatRupiah(grandTotal)}
            </span>
          </div>
          <p className="text-muted-foreground pt-1 text-[10px]">
            Perkiraan tampilan. Nominal final dihitung server.
          </p>
        </div>
      </CardContent>

      {/* Footer Actions */}
      <CardFooter className="flex flex-col gap-2 border-t pt-3">
        <div className="grid w-full grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleHoldDraft}
            disabled={cartItemsList.length === 0 || isSubmitting}
            className="w-full text-xs"
          >
            Tahan Draft
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onSubmitOrder}
            disabled={cartItemsList.length === 0 || isStoreClosed || isSubmitting}
            className="w-full text-xs font-semibold"
          >
            {isSubmitting ? 'Memproses...' : 'Lanjut ke Pembayaran'}
          </Button>
        </div>

        {isStoreClosed && (
          <p className="text-destructive text-center text-[11px]">
            Toko sedang tutup. Tidak dapat membuat pesanan baru.
          </p>
        )}
      </CardFooter>
    </Card>
  )
}
