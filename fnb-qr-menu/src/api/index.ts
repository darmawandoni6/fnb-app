import * as mocks from '@/mocks'

import { useMocks } from '@/lib/mode'

import * as httpMenu from './publicMenu'
import * as httpOrders from './publicOrders'
import * as httpSession from './session'
import { subscribeSessionEvents as httpSubscribeSessionEvents } from './socket'

export const openTableSession = useMocks ? mocks.openTableSession : httpSession.openTableSession
export const getPublicMenu = useMocks ? mocks.getPublicMenu : httpMenu.getPublicMenu
export const createPublicOrder = useMocks ? mocks.createPublicOrder : httpOrders.createPublicOrder
export const getPublicOrders = useMocks ? mocks.getPublicOrders : httpOrders.getPublicOrders
export const cancelPublicOrder = useMocks ? mocks.cancelPublicOrder : httpOrders.cancelPublicOrder
export const subscribeSessionEvents = useMocks
  ? mocks.subscribeSessionEvents
  : httpSubscribeSessionEvents
