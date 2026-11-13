import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { toast } from 'sonner'

import { useAuth } from '@/auth/context'
import { dashboardLinks } from '@/auth/guards'

import { Button } from '@/components/ui/button'

export function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const handleLogout = async () => {
    await logout()
    toast.success('Logout berhasil')
    navigate('/login', { replace: true })
  }

  return (
    <div className="bg-background text-foreground flex min-h-svh">
      <aside className="flex w-56 shrink-0 flex-col border-r p-4">
        <div className="mb-6">
          <p className="text-sm font-semibold">FNB Dashboard</p>
          <p className="text-muted-foreground text-xs">
            {user.name} · {user.role}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {dashboardLinks(user.role).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <Button variant="outline" onClick={() => void handleLogout()}>
          Logout
        </Button>
      </aside>
      <main className="min-w-0 flex-1 overflow-x-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
