import { NavLink } from 'react-router-dom'

import type { UserRole } from '@/constants'

import { dashboardLinks } from '@/auth/guards'

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

export function NavMain({ role }: { role: UserRole }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Menu</SidebarGroupLabel>
      <SidebarMenu>
        {dashboardLinks(role).map((item) => (
          <SidebarMenuItem key={item.to}>
            <NavLink to={item.to}>
              {({ isActive }) => (
                <SidebarMenuButton isActive={isActive} tooltip={item.label}>
                  <span>{item.label}</span>
                </SidebarMenuButton>
              )}
            </NavLink>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
