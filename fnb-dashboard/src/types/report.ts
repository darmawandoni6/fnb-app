export type ReportDatePreset = 'today' | 'last_7_days' | 'last_30_days' | 'this_month'

export type ReportFilter = {
  preset: ReportDatePreset
  from_date: string
  to_date: string
}

export type SalesReportSummary = {
  total_revenue: number
  total_orders: number
  average_order_value: number
  cash_revenue: number
  non_cash_revenue: number
  dine_in_orders_count: number
  take_away_orders_count: number
  total_items_sold: number
}

export type DailySalesTrend = {
  date: string
  revenue: number
  order_count: number
}

export type TopSellingMenuItem = {
  menu_id: string
  menu_name: string
  category_name: string
  qty_sold: number
  total_revenue: number
}

export type CategorySalesShare = {
  category_id: string
  category_name: string
  total_revenue: number
  total_items_sold: number
  percentage: number
}

export type TransactionHistoryParams = ReportFilter & {
  order_type?: string
  payment_method?: string
}
