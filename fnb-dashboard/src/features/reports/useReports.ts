import { useQuery } from '@tanstack/react-query'

import { api } from '@/api'
import type {
  CategorySalesShare,
  DailySalesTrend,
  Order,
  ReportDatePreset,
  ReportFilter,
  SalesReportSummary,
  TopSellingMenuItem,
  TransactionHistoryParams,
} from '@/types'

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
  return useQuery<SalesReportSummary>({
    queryKey: ['reports', 'summary', filter],
    queryFn: () => api.getSalesReportSummary(filter),
  })
}

export function useSalesTrends(filter: ReportFilter) {
  return useQuery<DailySalesTrend[]>({
    queryKey: ['reports', 'trends', filter],
    queryFn: () => api.getSalesTrends(filter),
  })
}

export function useTopSellingMenus(filter: ReportFilter, limit = 10) {
  return useQuery<TopSellingMenuItem[]>({
    queryKey: ['reports', 'top-menus', filter, limit],
    queryFn: () => api.getTopSellingMenus(filter, limit),
  })
}

export function useCategorySales(filter: ReportFilter) {
  return useQuery<CategorySalesShare[]>({
    queryKey: ['reports', 'categories', filter],
    queryFn: () => api.getCategorySales(filter),
  })
}

export function useTransactionHistory(params: TransactionHistoryParams) {
  return useQuery<Order[]>({
    queryKey: ['reports', 'transactions', params],
    queryFn: () => api.getTransactionHistory(params),
  })
}
