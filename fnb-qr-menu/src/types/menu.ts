export type MenuItem = {
  id: string
  name: string
  price: number
  imageUrl: string | null
}

export type MenuCategory = {
  id: string
  name: string
  menus: MenuItem[]
}

export type PublicMenu = {
  cafeName: string
  serviceRate: number
  taxRate: number
  isOpen: boolean
  categories: MenuCategory[]
}
