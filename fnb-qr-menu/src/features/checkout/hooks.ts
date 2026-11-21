import { useRef } from 'react'

import { useNavigate } from 'react-router-dom'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createPublicOrder } from '@/api'
import { toast } from 'sonner'

import { API_ERROR } from '@/constants/errors'
import { ROUTES } from '@/constants/routes'
import { isApiError } from '@/lib/apiError'
import type { CheckoutInput } from '@/schemas/checkout'

import { cartLines } from '@/features/browse/cart'
import { usePublicMenu } from '@/features/catalog/hooks'
import { catalogKeys } from '@/features/catalog/queries'
import { useCustomerSession } from '@/features/session/store'
import { withSessionRetry } from '@/features/session/token'

export function useSendOrder() {
  const [session, updateSession] = useCustomerSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: menuData } = usePublicMenu(session.sessionToken)
  const hasWarnedRateLimit = useRef(false)

  const allMenus = menuData?.categories.flatMap((c) => c.menus) ?? []
  const visibleLines = cartLines(session.cart, allMenus)

  const mutation = useMutation({
    mutationFn: (input: CheckoutInput) => {
      if (visibleLines.length === 0) {
        return Promise.reject(new Error('Keranjang kosong atau semua menu tidak tersedia'))
      }
      return withSessionRetry((sessionToken) =>
        createPublicOrder(sessionToken, {
          orderType: 'DINE_IN',
          customerName: input.customerName.trim(),
          customerPhone: input.customerPhone.trim() || null,
          paymentMethod: input.paymentMethod,
          items: visibleLines.map((line) => ({
            menuId: line.menuId,
            qty: line.qty,
            note: line.note || null,
          })),
        }),
      )
    },

    onSuccess: (response) => {
      updateSession((prev) => ({
        ...prev,
        cart: [],
        orders: [{ id: response.id, snapshot: response }, ...prev.orders],
      }))

      if (response.paymentUrl) {
        window.location.assign(response.paymentUrl)
        return
      }
      navigate(ROUTES.STATUS)
    },

    onError: (error: unknown) => {
      if (isApiError(error)) {
        if (error.status === 429) {
          if (!hasWarnedRateLimit.current) {
            hasWarnedRateLimit.current = true
            toast.error('Terlalu banyak pesanan. Coba lagi sebentar.')
          }
          return
        }
        hasWarnedRateLimit.current = false
        if (error.code === API_ERROR.STORE_CLOSED) {
          toast.error(error.message)
          void queryClient.invalidateQueries({ queryKey: catalogKeys.menu(session.sessionToken) })
          navigate(ROUTES.CLOSED)
          return
        }
        if (
          error.code === API_ERROR.STOCK_NOT_ENOUGH ||
          error.code === API_ERROR.VALIDATION_ERROR
        ) {
          toast.error(error.message)
          void queryClient.invalidateQueries({ queryKey: catalogKeys.menu(session.sessionToken) })
          return
        }
        toast.error(error.message)
        return
      }
      toast.error('Terjadi kesalahan. Silakan coba lagi.')
    },
  })

  return { mutation, visibleLines }
}
