import { useState } from 'react'

import { Minus, Plus, Trash2 } from 'lucide-react'

import { NOTE_MAX } from '@/constants/cart'
import { formatRupiah } from '@/lib/formatRupiah'
import type { MenuItem } from '@/types/menu'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { lineKey, saveCartLine } from '@/features/browse/cart'
import { type CartLine, useCustomerSession } from '@/features/session/store'

interface CartLineRowProps {
  line: CartLine & { key: string; menu: MenuItem }
  disabled?: boolean
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function CartLineRow({ line, disabled = false }: CartLineRowProps) {
  const [, updateSession] = useCustomerSession()
  const [note, setNote] = useState(line.note)
  const [confirmRemove, setConfirmRemove] = useState(false)

  function applyNoteChange(nextNote: string) {
    setNote(nextNote)
    updateSession((prev) => {
      const nextCart = [...prev.cart]
      saveCartLine(nextCart, line.key, line.menuId, line.qty, nextNote)
      return { ...prev, cart: nextCart }
    })
  }

  function changeQty(delta: number) {
    const nextQty = line.qty + delta
    if (nextQty < 1) {
      setConfirmRemove(true)
      return
    }
    updateSession((prev) => {
      const nextCart = prev.cart.map((l) =>
        l.menuId === line.menuId && lineKey(l.menuId, l.note) === line.key
          ? { ...l, qty: Math.min(50, Math.max(1, l.qty + delta)) }
          : l,
      )
      return { ...prev, cart: nextCart }
    })
  }

  function removeLine() {
    updateSession((prev) => ({
      ...prev,
      cart: prev.cart.filter(
        (l) => !(l.menuId === line.menuId && lineKey(l.menuId, l.note) === line.key),
      ),
    }))
  }

  return (
    <>
      <div className="border-border bg-surface flex gap-3 rounded-2xl border p-3.5 shadow-xs">
        {/* Thumbnail */}
        {line.menu.imageUrl ? (
          <img
            src={line.menu.imageUrl}
            alt={line.menu.name}
            className="size-16 shrink-0 rounded-xl object-cover"
            loading="lazy"
          />
        ) : (
          <div className="bg-surface-muted text-accent font-editorial flex size-16 shrink-0 items-center justify-center rounded-xl text-base font-semibold">
            {getInitials(line.menu.name)}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/* Name + price + remove */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-text truncate font-medium">{line.menu.name}</p>
              <p className="text-text mt-0.5 text-sm font-semibold">
                {formatRupiah(line.menu.price)}
              </p>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setConfirmRemove(true)}
              aria-label={`Hapus ${line.menu.name}`}
              className="text-text-muted hover:text-destructive flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-50"
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          {/* Note textarea */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <label className="text-text-muted text-xs">Catatan</label>
              <span className="text-text-muted text-xs">
                {note.length}/{NOTE_MAX}
              </span>
            </div>
            <Textarea
              value={note}
              disabled={disabled}
              maxLength={NOTE_MAX}
              placeholder="Contoh: tanpa es, kurang manis..."
              className="resize-none text-xs"
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              onBlur={(e) => {
                const trimmed = e.target.value.trim()
                if (trimmed !== line.note) applyNoteChange(trimmed)
              }}
            />
          </div>

          {/* Qty stepper */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={disabled}
              onClick={() => changeQty(-1)}
              aria-label="Kurangi jumlah"
              className="rounded-full"
            >
              <Minus className="size-3.5" />
            </Button>
            <span className="text-text w-6 text-center text-sm font-bold">{line.qty}</span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={disabled || line.qty >= 50}
              onClick={() => changeQty(1)}
              aria-label="Tambah jumlah"
              className="rounded-full"
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Remove confirmation dialog */}
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus dari keranjang?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{line.menu.name}</strong> akan dihapus dari keranjang Anda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={removeLine}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
