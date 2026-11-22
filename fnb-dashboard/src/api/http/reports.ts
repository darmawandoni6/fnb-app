import type {
  CategorySalesShare,
  DailySalesTrend,
  Order,
  ReportFilter,
  SalesReportSummary,
  TopSellingMenuItem,
  TransactionHistoryParams,
} from '@/types'

import { request } from '../client'
import { type ServerOrder, toOrder } from './orders'

export type ReportsSummary = {
  summary: SalesReportSummary
  trends: DailySalesTrend[]
  top_menus: TopSellingMenuItem[]
  categories: CategorySalesShare[]
}

const rangeParams = (filter: ReportFilter) => ({ from: filter.from_date, to: filter.to_date })

export const getReportsSummary = (filter: ReportFilter): Promise<ReportsSummary> =>
  request<ReportsSummary>({ method: 'GET', url: '/reports/summary', params: rangeParams(filter) })

export const getTransactionHistory = async (params: TransactionHistoryParams): Promise<Order[]> => {
  const orders = await request<ServerOrder[]>({
    method: 'GET',
    url: '/reports/transactions',
    params: {
      ...rangeParams(params),
      order_type: params.order_type,
      payment_method: params.payment_method,
    },
  })
  return orders.map(toOrder)
}
