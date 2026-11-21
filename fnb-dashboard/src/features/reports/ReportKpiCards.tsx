import type { SalesReportSummary } from '@/types'
import { CreditCard, Receipt, TrendingUp, Utensils } from 'lucide-react'

import { formatRupiah } from '@/lib/format'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type ReportKpiCardsProps = {
  summary?: SalesReportSummary
  isLoading: boolean
}

export function ReportKpiCards({ summary, isLoading }: ReportKpiCardsProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx} className="p-4">
            <Skeleton className="mb-2 h-4 w-28" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="mt-2 h-3 w-44" />
          </Card>
        ))}
      </div>
    )
  }

  const cashPercent =
    summary.total_revenue > 0 ? Math.round((summary.cash_revenue / summary.total_revenue) * 100) : 0
  const nonCashPercent =
    summary.total_revenue > 0
      ? Math.round((summary.non_cash_revenue / summary.total_revenue) * 100)
      : 0

  const dineInPercent =
    summary.total_orders > 0
      ? Math.round((summary.dine_in_orders_count / summary.total_orders) * 100)
      : 0
  const takeAwayPercent =
    summary.total_orders > 0
      ? Math.round((summary.take_away_orders_count / summary.total_orders) * 100)
      : 0

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            Total Pendapatan
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatRupiah(summary.total_revenue)}</div>
          <p className="text-muted-foreground mt-1 text-xs">
            Tunai: {cashPercent}% | Non-Tunai: {nonCashPercent}%
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            Total Transaksi
          </CardTitle>
          <Receipt className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.total_orders.toLocaleString('id-ID')}</div>
          <p className="text-muted-foreground mt-1 text-xs">
            Dine In: {dineInPercent}% ({summary.dine_in_orders_count}) | Take Away:{' '}
            {takeAwayPercent}% ({summary.take_away_orders_count})
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            Rata-rata Order (AOV)
          </CardTitle>
          <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatRupiah(summary.average_order_value)}</div>
          <p className="text-muted-foreground mt-1 text-xs">Per transaksi yang selesai</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">Item Terjual</CardTitle>
          <Utensils className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.total_items_sold.toLocaleString('id-ID')}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">Total porsi menu terjual</p>
        </CardContent>
      </Card>
    </div>
  )
}
