import * as mockMenu from '@/mocks/handlers/publicMenu'
import * as mockOrders from '@/mocks/handlers/publicOrders'

import { useMocks } from '@/lib/mode'

import * as httpMenu from './publicMenu'
import * as httpOrders from './publicOrders'

export const getPublicMenu = useMocks ? mockMenu.getPublicMenu : httpMenu.getPublicMenu
export const createPublicOrder = useMocks
  ? mockOrders.createPublicOrder
  : httpOrders.createPublicOrder
export const getPublicOrder = useMocks ? mockOrders.getPublicOrder : httpOrders.getPublicOrder
export const cancelOrderItem = useMocks ? mockOrders.cancelOrderItem : httpOrders.cancelOrderItem
