import * as mocks from '@/mocks'

import { useMocks } from '@/lib/mode'

import * as httpMenu from './publicMenu'
import * as httpOrders from './publicOrders'

export const getPublicMenu = useMocks ? mocks.getPublicMenu : httpMenu.getPublicMenu
export const createPublicOrder = useMocks ? mocks.createPublicOrder : httpOrders.createPublicOrder
export const getPublicOrder = useMocks ? mocks.getPublicOrder : httpOrders.getPublicOrder
export const cancelOrderItem = useMocks ? mocks.cancelOrderItem : httpOrders.cancelOrderItem
