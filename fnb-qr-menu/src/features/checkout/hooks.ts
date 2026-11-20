import { useNavigate } from 'react-router-dom'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createPublicOrder } from '@/api'
import { toast } from 'sonner'

import { API_ERROR } from '@/constants/errors'
import { ROUTES } from '@/constants/routes'
import { isApiError } from '@/lib/apiError'
import type { MenuItem } from '@/types/menu'
import type { CreatePublicOrderResponse } from '@/types/order'

import { cartLines } from '@/features/browse/cart'
import { usePublicMenu } from '@/features/catalog/hooks'
import { catalogKeys } from '@/features/catalog/queries'
import { useCustomerSession } from '@/features/session/store'

export function useSendOrder() {
  const [session, updateSession] = useCustomerSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: menuData } = usePublicMenu(session.qr)

  const allMenus: MenuItem[] = menuData?.categories.flatMap((c) => c.menus) ?? []
  const visibleLines = cartLines(session.cart, allMenus)

  const mutation = useMutation({
    mutationFn: () => {
      if (visibleLines.length === 0) {
        return Promise.reject(new Error('Keranjang kosong atau semua menu tidak tersedia'))
      }
      return createPublicOrder(session.qr, {
        items: visibleLines.map((l) => ({
          menuId: l.menuId,
          qty: l.qty,
          note: l.note || null,
        })),
      })
    },

    onSuccess: (response: CreatePublicOrderResponse) => {
      updateSession((prev) => ({
        ...prev,
        cart: [],
        orders: [
          {
            id: response.orderId,
            trackingToken: response.trackingToken,
            snapshot: response,
          },
          ...prev.orders,
        ],
      }))
      navigate(ROUTES.STATUS)
    },

    onError: (error: unknown) => {
      if (isApiError(error)) {
        if (error.code === API_ERROR.STORE_CLOSED) {
          toast.error(error.message)
          void queryClient.invalidateQueries({ queryKey: catalogKeys.menu(session.qr) })
          navigate(ROUTES.CLOSED)
          return
        }
        if (
          error.code === API_ERROR.STOCK_NOT_ENOUGH ||
          error.code === API_ERROR.VALIDATION_ERROR
        ) {
          toast.error(error.message)
          void queryClient.invalidateQueries({ queryKey: catalogKeys.menu(session.qr) })
          return
        }
      }
      toast.error('Terjadi kesalahan. Silakan coba lagi.')
    },
  })

  return { mutation, visibleLines }
}
