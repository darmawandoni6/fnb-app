import type { ComponentType } from 'react'

export type NavItem = {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
}

export type NavGroup = {
  title: string
  items: NavItem[]
}
