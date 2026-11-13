import { Navigate, Outlet } from 'react-router-dom'

import { ROUTES, USER_ROLE, type UserRole } from '@/constants'

import { useAuth } from '@/auth/context'

import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

export function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  if (!user) return <Navigate to={ROUTES.LOGIN} replace />
  return <Outlet />
}

export function RoleGuard({ roles }: { roles: UserRole[] }) {
  const { user } = useAuth()
  if (!user || roles.includes(user.role)) return <Outlet />
  return (
    <Empty className="m-6 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">🔒</EmptyMedia>
        <EmptyTitle>Anda tidak memiliki akses ke halaman ini</EmptyTitle>
      </EmptyHeader>
    </Empty>
  )
}

type DashboardLink = { to: string; label: string }

export const dashboardLinks = (role: UserRole): DashboardLink[] => {
  if (role === USER_ROLE.OWNER) {
    return [
      { to: ROUTES.ORDERS, label: 'Orders' },
      { to: ROUTES.MENUS, label: 'Menus' },
      { to: ROUTES.TABLES, label: 'Tables' },
      { to: ROUTES.STOCK, label: 'Stock' },
      { to: ROUTES.USERS, label: 'Users' },
      { to: ROUTES.SETTINGS, label: 'Settings' },
      { to: ROUTES.REPORTS, label: 'Reports' },
    ]
  }
  if (role === USER_ROLE.CASHIER) return [{ to: ROUTES.ORDERS, label: 'Orders' }]
  return [{ to: ROUTES.KITCHEN, label: 'Kitchen Board' }]
}
