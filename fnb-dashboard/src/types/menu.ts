export type Menu = {
  id: string
  name: string
  price: number
  image_url: string | null
  is_available: boolean
}

export type Category = {
  id: string
  name: string
  menus: Menu[]
}
