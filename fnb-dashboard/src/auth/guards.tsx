import { Navigate, Outlet } from 'react-router-dom'

import { ROUTES, USER_ROLE, type UserRole } from '@/constants'
import type { NavGroup } from '@/types'
import {
  BarChart3,
  Boxes,
  ChefHat,
  LayoutGrid,
  ScrollText,
  Settings,
  ShoppingBag,
  Users,
  UtensilsCrossed,
} from 'lucide-react'

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

export const dashboardNavGroups = (role: UserRole): NavGroup[] => {
  if (role === USER_ROLE.OWNER) {
    return [
      {
        title: 'Operasional',
        items: [{ to: ROUTES.ORDERS, label: 'Orders', icon: ShoppingBag }],
      },
      {
        title: 'Katalog & Meja',
        items: [
          { to: ROUTES.MENUS, label: 'Menus', icon: UtensilsCrossed },
          { to: ROUTES.TABLES, label: 'Tables', icon: LayoutGrid },
          { to: ROUTES.STOCK, label: 'Stock', icon: Boxes },
        ],
      },
      {
        title: 'Bisnis & Sistem',
        items: [
          { to: ROUTES.REPORTS, label: 'Reports', icon: BarChart3 },
          { to: ROUTES.USERS, label: 'Users', icon: Users },
          { to: ROUTES.SETTINGS, label: 'Settings', icon: Settings },
          { to: ROUTES.AUDIT_LOG, label: 'Audit Log', icon: ScrollText },
        ],
      },
    ]
  }

  if (role === USER_ROLE.CASHIER) {
    return [
      {
        title: 'Operasional',
        items: [{ to: ROUTES.ORDERS, label: 'Orders', icon: ShoppingBag }],
      },
      {
        title: 'Persediaan',
        items: [
          { to: ROUTES.MENUS, label: 'Menus', icon: UtensilsCrossed },
          { to: ROUTES.STOCK, label: 'Stock', icon: Boxes },
        ],
      },
    ]
  }

  return [
    {
      title: 'Dapur',
      items: [{ to: ROUTES.KITCHEN, label: 'Kitchen Board', icon: ChefHat }],
    },
  ]
}
