import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { DashboardLayout } from '@/pages/DashboardLayout'
import { KitchenPage } from '@/pages/KitchenPage'
import { LoginPage } from '@/pages/LoginPage'
import { OrdersPage } from '@/pages/OrdersPage'
import { StubPage } from '@/pages/StubPage'
import { Toaster } from 'sonner'

import { USER_ROLE } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'

import { useAuth } from '@/auth/context'
import { AuthProvider } from '@/auth/context'
import { ProtectedRoute, RoleGuard } from '@/auth/guards'

import { TooltipProvider } from '@/components/ui/tooltip'

const staff = [USER_ROLE.OWNER, USER_ROLE.CASHIER]
const owner = [USER_ROLE.OWNER]

function RoleHome() {
  const { user } = useAuth()
  if (!user) return null
  if (user.role === USER_ROLE.KITCHEN) return <Navigate to={ROUTES.KITCHEN} replace />
  return <Navigate to={ROUTES.ORDERS} replace />
}

const router = createBrowserRouter([
  { path: ROUTES.LOGIN, element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { index: true, element: <RoleHome /> },
          {
            path: ROUTES.ORDERS,
            element: <RoleGuard roles={staff} />,
            children: [{ index: true, element: <OrdersPage /> }],
          },
          {
            path: ROUTES.KITCHEN,
            element: <RoleGuard roles={[USER_ROLE.OWNER, USER_ROLE.KITCHEN]} />,
            children: [{ index: true, element: <KitchenPage /> }],
          },
          {
            path: ROUTES.MENUS,
            element: <RoleGuard roles={owner} />,
            children: [{ index: true, element: <StubPage title="Menus" /> }],
          },
          {
            path: ROUTES.TABLES,
            element: <RoleGuard roles={owner} />,
            children: [{ index: true, element: <StubPage title="Tables" /> }],
          },
          {
            path: ROUTES.STOCK,
            element: <RoleGuard roles={owner} />,
            children: [{ index: true, element: <StubPage title="Stock" /> }],
          },
          {
            path: ROUTES.USERS,
            element: <RoleGuard roles={owner} />,
            children: [{ index: true, element: <StubPage title="Users" /> }],
          },
          {
            path: ROUTES.SETTINGS,
            element: <RoleGuard roles={owner} />,
            children: [{ index: true, element: <StubPage title="Settings" /> }],
          },
          {
            path: ROUTES.REPORTS,
            element: <RoleGuard roles={owner} />,
            children: [{ index: true, element: <StubPage title="Reports" /> }],
          },
        ],
      },
    ],
  },
])

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 4_000, retry: 1 } } })

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
