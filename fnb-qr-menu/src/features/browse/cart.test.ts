import { describe, expect, it } from 'vitest'

import { MAX_QTY } from '@/constants/cart'
import type { MenuItem } from '@/types/menu'

import {
  addToCart,
  cartLines,
  clampQty,
  lineKey,
  qtyOf,
  saveCartLine,
} from '@/features/browse/cart'
import type { CartLine } from '@/features/session/store'

describe('cart helpers', () => {
  it('computes lineKey correctly with normalized trimming and lowercasing', () => {
    expect(lineKey('m1', '  Manis  ')).toBe('m1|manis')
    expect(lineKey('m1', '')).toBe('m1|')
  })

  it('clamps qty within [1, MAX_QTY]', () => {
    expect(clampQty(-5)).toBe(1)
    expect(clampQty(0)).toBe(1)
    expect(clampQty(5)).toBe(5)
    expect(clampQty(100)).toBe(MAX_QTY)
  })

  it('calculates total qty across different notes for a menu', () => {
    const cart: CartLine[] = [
      { menuId: 'm1', qty: 2, note: 'dingin' },
      { menuId: 'm1', qty: 3, note: 'panas' },
      { menuId: 'm2', qty: 1, note: '' },
    ]
    expect(qtyOf(cart, 'm1')).toBe(5)
    expect(qtyOf(cart, 'm2')).toBe(1)
    expect(qtyOf(cart, 'm3')).toBe(0)
  })

  it('addToCart adds a new line or merges equal lines', () => {
    const cart: CartLine[] = []
    addToCart(cart, 'm1', 2, 'es sedikit')
    expect(cart).toEqual([{ menuId: 'm1', qty: 2, note: 'es sedikit' }])

    // Adding same note merges and sums qty
    addToCart(cart, 'm1', 3, 'es sedikit')
    expect(cart).toEqual([{ menuId: 'm1', qty: 5, note: 'es sedikit' }])

    // Adding different note creates a new line
    addToCart(cart, 'm1', 1, 'tanpa es')
    expect(cart).toHaveLength(2)
  })

  it('addToCart clamps merged qty to MAX_QTY', () => {
    const cart: CartLine[] = [{ menuId: 'm1', qty: 45, note: '' }]
    addToCart(cart, 'm1', 10, '')
    expect(cart[0].qty).toBe(MAX_QTY)
  })

  it('saveCartLine handles added, saved, and merged operations', () => {
    const cart: CartLine[] = [
      { menuId: 'm1', qty: 2, note: 'pedas' },
      { menuId: 'm1', qty: 1, note: 'manis' },
    ]

    // 1. Edit a non-existing editKey adds to cart
    const addResult = saveCartLine(cart, 'non-existent', 'm2', 2, '')
    expect(addResult).toBe('added')
    expect(cart).toHaveLength(3)

    // 2. Edit existing line with a unique note updates it ('saved')
    const savedResult = saveCartLine(cart, lineKey('m1', 'pedas'), 'm1', 4, 'sangat pedas')
    expect(savedResult).toBe('saved')
    expect(cart.find((l) => l.note === 'sangat pedas')?.qty).toBe(4)

    // 3. Edit existing line so its note matches another line of the same menu merges them ('merged')
    // Changing 'sangat pedas' to 'manis' merges with the other 'manis' line
    const mergedResult = saveCartLine(cart, lineKey('m1', 'sangat pedas'), 'm1', 3, 'manis')
    expect(mergedResult).toBe('merged')
    const manisLine = cart.find((l) => l.menuId === 'm1' && l.note === 'manis')
    expect(manisLine?.qty).toBe(4) // 1 + 3 = 4
    expect(cart.filter((l) => l.menuId === 'm1')).toHaveLength(1)
  })

  it('cartLines joins with menu and drops lines whose menu disappeared', () => {
    const cart: CartLine[] = [
      { menuId: 'm1', qty: 2, note: '' },
      { menuId: 'm-deleted', qty: 1, note: '' },
    ]
    const menus: MenuItem[] = [
      { id: 'm1', name: 'Latte', price: 25000, imageUrl: null },
      { id: 'm2', name: 'Croissant', price: 20000, imageUrl: null },
    ]

    const joined = cartLines(cart, menus)
    expect(joined).toHaveLength(1)
    expect(joined[0].menu.name).toBe('Latte')
    expect(joined[0].key).toBe('m1|')
  })
})
