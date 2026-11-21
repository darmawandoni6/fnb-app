import type { PublicMenu } from '@/types/menu'

export const OPEN_MENU: PublicMenu = {
  cafeName: 'Kopi Senja',
  serviceRate: 5,
  taxRate: 10,
  isOpen: true,
  categories: [
    {
      id: 'category-kopi',
      name: 'Kopi',
      menus: [
        { id: 'menu-espresso', name: 'Espresso', price: 18000, imageUrl: null },
        { id: 'menu-americano', name: 'Americano', price: 22000, imageUrl: '/menu/americano.jpg' },
        { id: 'menu-latte', name: 'Latte', price: 28000, imageUrl: '/menu/latte.jpg' },
        {
          id: 'menu-cappuccino',
          name: 'Cappuccino',
          price: 28000,
          imageUrl: '/menu/cappuccino.jpg',
        },
      ],
    },
    {
      id: 'category-non-kopi',
      name: 'Non-Kopi',
      menus: [
        { id: 'menu-matcha', name: 'Matcha Latte', price: 32000, imageUrl: '/menu/matcha.jpg' },
        { id: 'menu-chocolate', name: 'Chocolate', price: 27000, imageUrl: '/menu/chocolate.jpg' },
        { id: 'menu-teh', name: 'Teh Melati', price: 15000, imageUrl: null },
      ],
    },
    {
      id: 'category-makanan',
      name: 'Makanan',
      menus: [
        { id: 'menu-croissant', name: 'Croissant', price: 25000, imageUrl: '/menu/croissant.jpg' },
        {
          id: 'menu-pisang-goreng',
          name: 'Pisang Goreng',
          price: 20000,
          imageUrl: '/menu/pisang-goreng.jpg',
        },
        {
          id: 'menu-nasi-goreng',
          name: 'Nasi Goreng Senja',
          price: 35000,
          imageUrl: '/menu/nasi-goreng.jpg',
        },
      ],
    },
  ],
}

export const CLOSED_MENU: PublicMenu = {
  ...OPEN_MENU,
  isOpen: false,
}
