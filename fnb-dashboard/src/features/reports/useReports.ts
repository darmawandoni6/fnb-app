import { useQuery } from '@tanstack/react-query'

import { api } from '@/api'
import type { Order, ReportDatePreset, ReportFilter, TransactionHistoryParams } from '@/types'

import type { ReportsSummary } from '@/api/http/reports'
import { todayUTC } from '@/lib/format'

export const getDatesForPreset = (
  preset: ReportDatePreset,
): { from_date: string; to_date: string } => {
  const today = todayUTC()
  const now = new Date()

  if (preset === 'today') {
    return { from_date: today, to_date: today }
  }

  if (preset === 'last_7_days') {
    const from = new Date(now.getTime() - 6 * 86_400_000).toISOString().slice(0, 10)
    return { from_date: from, to_date: today }
  }

  if (preset === 'last_30_days') {
    const from = new Date(now.getTime() - 29 * 86_400_000).toISOString().slice(0, 10)
    return { from_date: from, to_date: today }
  }

  if (preset === 'this_month') {
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return { from_date: `${year}-${month}-01`, to_date: today }
  }

  return { from_date: today, to_date: today }
}

export function useSalesReportSummary(filter: ReportFilter) {
  return useReportsSummary(filter, (data) => data.summary)
}

export function useSalesTrends(filter: ReportFilter) {
  return useReportsSummary(filter, (data) => data.trends)
}

export function useTopSellingMenus(filter: ReportFilter, limit = 10) {
  // `limit` stays for the caller signature; the server caps top menus at 10.
  void limit
  return useReportsSummary(filter, (data) => data.top_menus)
}

export function useCategorySales(filter: ReportFilter) {
  return useReportsSummary(filter, (data) => data.categories)
}

/**
 * The four aggregate tabs read one endpoint, so one cached query serves all of
 * them. `select` keeps each hook's return type unchanged.
 */
function useReportsSummary<T>(filter: ReportFilter, select: (data: ReportsSummary) => T) {
  return useQuery<ReportsSummary, Error, T>({
    queryKey: ['reports', 'summary', filter],
    queryFn: () => api.getReportsSummary(filter),
    select,
  })
}

export function useTransactionHistory(params: TransactionHistoryParams) {
  return useQuery<Order[]>({
    queryKey: ['reports', 'transactions', params],
    queryFn: () => api.getTransactionHistory(params),
  })
}
