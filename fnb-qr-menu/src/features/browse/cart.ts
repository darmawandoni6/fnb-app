import { MAX_QTY } from '@/constants/cart'
import type { MenuItem } from '@/types/menu'

import type { CartLine } from '@/features/session/store'

export const lineKey = (menuId: string, note: string) => `${menuId}|${note.trim().toLowerCase()}`

export const clampQty = (n: number) => Math.max(1, Math.min(MAX_QTY, n))

export const qtyOf = (cart: CartLine[], menuId: string) =>
  cart.filter((l) => l.menuId === menuId).reduce((a, l) => a + l.qty, 0)

export function addToCart(cart: CartLine[], menuId: string, qty: number, note = '') {
  const trimmed = note.trim()
  const key = lineKey(menuId, trimmed)
  const ex = cart.find((l) => lineKey(l.menuId, l.note) === key)
  if (ex) {
    ex.qty = clampQty(ex.qty + qty)
  } else {
    cart.push({ menuId, qty: clampQty(qty), note: trimmed })
  }
}

export function saveCartLine(
  cart: CartLine[],
  editKey: string | null | undefined,
  menuId: string,
  qty: number,
  note: string,
): 'merged' | 'saved' | 'added' {
  const trimmed = note.trim()
  const idx = editKey
    ? cart.findIndex((l) => l.menuId === menuId && lineKey(l.menuId, l.note) === editKey)
    : -1

  if (idx < 0) {
    addToCart(cart, menuId, qty, trimmed)
    return 'added'
  }

  const key = lineKey(menuId, trimmed)
  const dup = cart.findIndex((l, i) => i !== idx && lineKey(l.menuId, l.note) === key)
  const other = dup >= 0 ? cart[dup] : undefined
  if (other) {
    other.qty = clampQty(other.qty + qty)
    cart.splice(idx, 1)
    return 'merged'
  }

  cart[idx] = { menuId, qty: clampQty(qty), note: trimmed }
  return 'saved'
}

export type JoinedCartLine = CartLine & {
  key: string
  menu: MenuItem
}

export function cartLines(cart: CartLine[], menus: MenuItem[]): JoinedCartLine[] {
  const byId = new Map(menus.map((m) => [m.id, m]))
  return cart.flatMap((l) => {
    const m = byId.get(l.menuId)
    return m ? [{ ...l, key: lineKey(l.menuId, l.note), menu: m }] : []
  })
}
