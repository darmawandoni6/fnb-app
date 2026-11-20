import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ROUTES } from '@/constants/routes'

import { Toaster } from '@/components/ui/sonner'
import { MenuDetailPage } from '@/features/browse/pages/MenuDetailPage'
import { MenuHomePage } from '@/features/browse/pages/MenuHomePage'
import { CartPage } from '@/features/checkout/pages/CartPage'
import { ClosedPage } from '@/features/checkout/pages/ClosedPage'
import { InvalidTablePage } from '@/features/checkout/pages/InvalidTablePage'
import { StatusPage } from '@/features/orders/pages/StatusPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path={ROUTES.HOME} element={<MenuHomePage />} />
          <Route path={ROUTES.MENU} element={<MenuDetailPage />} />
          <Route path={ROUTES.CART} element={<CartPage />} />
          <Route path={ROUTES.STATUS} element={<StatusPage />} />
          <Route path={ROUTES.INVALID} element={<InvalidTablePage />} />
          <Route path={ROUTES.CLOSED} element={<ClosedPage />} />
          <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  )
}
