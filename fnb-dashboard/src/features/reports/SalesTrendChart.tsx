import { useMemo, useState } from 'react'

import type { DailySalesTrend } from '@/types'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { formatRupiah } from '@/lib/format'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'

type SalesTrendChartProps = {
  data?: DailySalesTrend[]
  isLoading: boolean
}

type MetricMode = 'revenue' | 'volume'

const chartConfig = {
  revenue: {
    label: 'Pendapatan',
    color: '#10b981',
  },
  order_count: {
    label: 'Volume Order',
    color: '#3b82f6',
  },
} satisfies ChartConfig

export function SalesTrendChart({ data, isLoading }: SalesTrendChartProps) {
  const [metric, setMetric] = useState<MetricMode>('revenue')

  const chartData = useMemo(() => {
    if (!data) return []
    return data.map((item) => {
      // Date formatting for X-Axis tick: "17/11" or "17 Nov"
      const dateObj = new Date(item.date)
      const formattedDate = new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
      }).format(dateObj)

      return {
        ...item,
        displayDate: formattedDate,
      }
    })
  }, [data])

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-1 h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Tren Penjualan Harian</CardTitle>
          <CardDescription>
            {metric === 'revenue'
              ? 'Grafik fluktuasi omzet harian dalam periode terpilih'
              : 'Grafik jumlah pesanan yang diselesaikan setiap hari'}
          </CardDescription>
        </div>
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <Button
            size="sm"
            variant={metric === 'revenue' ? 'default' : 'outline'}
            onClick={() => setMetric('revenue')}
            className="h-8 text-xs"
          >
            Pendapatan (Rp)
          </Button>
          <Button
            size="sm"
            variant={metric === 'volume' ? 'default' : 'outline'}
            onClick={() => setMetric('volume')}
            className="h-8 text-xs"
          >
            Volume Pesanan
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[320px] w-full">
          {metric === 'revenue' ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="displayDate"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={20}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${val >= 1000 ? Math.round(val / 1000) + 'k' : val}`}
                width={40}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(val) => (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatRupiah(Number(val))}
                      </span>
                    )}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#fillRevenue)"
              />
            </AreaChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="displayDate"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={20}
              />
              <YAxis tickLine={false} axisLine={false} width={30} allowDecimals={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(val) => (
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {val} order
                      </span>
                    )}
                  />
                }
              />
              <Bar dataKey="order_count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
