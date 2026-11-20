import { Link } from 'react-router-dom'

import { ShoppingBag } from 'lucide-react'

import { ROUTES } from '@/constants/routes'

interface CartBarProps {
  itemCount: number
}

export function CartBar({ itemCount }: CartBarProps) {
  if (itemCount <= 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 p-4">
      <div className="pointer-events-auto mx-auto max-w-xl">
        <Link
          to={ROUTES.CART}
          className="bg-accent flex h-14 w-full items-center justify-between rounded-full px-5 text-white shadow-lg transition-transform active:scale-[0.98]"
        >
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="size-5" />
            <span className="font-medium">{itemCount} item di keranjang</span>
          </div>
          <span className="text-sm font-semibold">Lihat Keranjang &rarr;</span>
        </Link>
      </div>
    </div>
  )
}
