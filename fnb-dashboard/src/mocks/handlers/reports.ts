import { ORDER_STATUS, ORDER_TYPE, PAYMENT_METHOD, PAYMENT_STATUS, USER_ROLE } from '@/constants'
import { db } from '@/mocks/db'
import type {
  CategorySalesShare,
  DailySalesTrend,
  Order,
  ReportFilter,
  SalesReportSummary,
  TopSellingMenuItem,
  TransactionHistoryParams,
} from '@/types'

import { delay, requireRole } from './shared'

const filterOrdersByDate = (from: string, to: string): Order[] => {
  return db.orders.filter((order) => {
    const orderDate = order.created_at.slice(0, 10)
    return (
      orderDate >= from &&
      orderDate <= to &&
      order.status !== ORDER_STATUS.DIBATALKAN &&
      order.payment_status === PAYMENT_STATUS.LUNAS
    )
  })
}

export const getSalesReportSummary = async (filter: ReportFilter): Promise<SalesReportSummary> => {
  await delay()
  requireRole(USER_ROLE.OWNER)

  const paidOrders = filterOrdersByDate(filter.from_date, filter.to_date)
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total_amount, 0)
  const totalOrders = paidOrders.length
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

  const cashRevenue = paidOrders
    .filter((o) => o.payment_method === PAYMENT_METHOD.CASH)
    .reduce((sum, o) => sum + o.total_amount, 0)

  const nonCashRevenue = paidOrders
    .filter((o) => o.payment_method === PAYMENT_METHOD.NON_CASH)
    .reduce((sum, o) => sum + o.total_amount, 0)

  const qrCount = paidOrders.filter((o) => o.order_type === ORDER_TYPE.QR).length
  const manualCount = paidOrders.filter((o) => o.order_type === ORDER_TYPE.MANUAL).length

  const totalItemsSold = paidOrders.reduce(
    (sum, o) => sum + o.items.reduce((itemSum, item) => itemSum + item.qty, 0),
    0,
  )

  return {
    total_revenue: totalRevenue,
    total_orders: totalOrders,
    average_order_value: avgOrderValue,
    cash_revenue: cashRevenue,
    non_cash_revenue: nonCashRevenue,
    qr_orders_count: qrCount,
    manual_orders_count: manualCount,
    total_items_sold: totalItemsSold,
  }
}

export const getSalesTrends = async (filter: ReportFilter): Promise<DailySalesTrend[]> => {
  await delay()
  requireRole(USER_ROLE.OWNER)

  const paidOrders = filterOrdersByDate(filter.from_date, filter.to_date)

  // Build daily map between from_date and to_date
  const trendsMap = new Map<string, { revenue: number; order_count: number }>()

  const startDate = new Date(filter.from_date)
  const endDate = new Date(filter.to_date)
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().slice(0, 10)
    trendsMap.set(dateStr, { revenue: 0, order_count: 0 })
    currentDate.setDate(currentDate.getDate() + 1)
  }

  for (const order of paidOrders) {
    const dateStr = order.created_at.slice(0, 10)
    const existing = trendsMap.get(dateStr)
    if (existing) {
      existing.revenue += order.total_amount
      existing.order_count += 1
    }
  }

  return Array.from(trendsMap.entries()).map(([date, data]) => ({
    date,
    revenue: data.revenue,
    order_count: data.order_count,
  }))
}

export const getTopSellingMenus = async (
  filter: ReportFilter,
  limit = 10,
): Promise<TopSellingMenuItem[]> => {
  await delay()
  requireRole(USER_ROLE.OWNER)

  const paidOrders = filterOrdersByDate(filter.from_date, filter.to_date)
  const menuMap = new Map<string, TopSellingMenuItem>()

  for (const order of paidOrders) {
    for (const item of order.items) {
      const existing = menuMap.get(item.menu_id)
      const category = db.categories.find((c) => c.menus.some((m) => m.id === item.menu_id))
      const categoryName = category?.name ?? 'Other'

      if (existing) {
        existing.qty_sold += item.qty
        existing.total_revenue += item.qty * item.unit_price
      } else {
        menuMap.set(item.menu_id, {
          menu_id: item.menu_id,
          menu_name: item.menu_name,
          category_name: categoryName,
          qty_sold: item.qty,
          total_revenue: item.qty * item.unit_price,
        })
      }
    }
  }

  return Array.from(menuMap.values())
    .sort((a, b) => b.qty_sold - a.qty_sold)
    .slice(0, limit)
}

export const getCategorySales = async (filter: ReportFilter): Promise<CategorySalesShare[]> => {
  await delay()
  requireRole(USER_ROLE.OWNER)

  const paidOrders = filterOrdersByDate(filter.from_date, filter.to_date)
  const categoryMap = new Map<string, { name: string; revenue: number; itemsSold: number }>()

  // Initialize from db.categories
  for (const category of db.categories) {
    categoryMap.set(category.id, {
      name: category.name,
      revenue: 0,
      itemsSold: 0,
    })
  }

  let grandRevenue = 0

  for (const order of paidOrders) {
    for (const item of order.items) {
      const category = db.categories.find((c) => c.menus.some((m) => m.id === item.menu_id))
      const catId = category?.id ?? 'other'
      const catName = category?.name ?? 'Other'

      const existing = categoryMap.get(catId) ?? {
        name: catName,
        revenue: 0,
        itemsSold: 0,
      }

      const itemRev = item.qty * item.unit_price
      existing.revenue += itemRev
      existing.itemsSold += item.qty
      grandRevenue += itemRev
      categoryMap.set(catId, existing)
    }
  }

  return Array.from(categoryMap.entries()).map(([id, data]) => ({
    category_id: id,
    category_name: data.name,
    total_revenue: data.revenue,
    total_items_sold: data.itemsSold,
    percentage: grandRevenue > 0 ? Math.round((data.revenue / grandRevenue) * 100) : 0,
  }))
}

export const getTransactionHistory = async (params: TransactionHistoryParams): Promise<Order[]> => {
  await delay()
  requireRole(USER_ROLE.OWNER)

  return db.orders
    .filter((order) => {
      const orderDate = order.created_at.slice(0, 10)
      if (orderDate < params.from_date || orderDate > params.to_date) return false

      if (params.order_type && params.order_type !== 'ALL') {
        if (order.order_type !== params.order_type) return false
      }

      if (params.payment_method && params.payment_method !== 'ALL') {
        if (order.payment_method !== params.payment_method) return false
      }

      return true
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}
