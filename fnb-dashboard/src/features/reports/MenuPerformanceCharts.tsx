import type { CategorySalesShare, TopSellingMenuItem } from '@/types'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'

import { formatRupiah } from '@/lib/format'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'

type MenuPerformanceChartsProps = {
  topMenus?: TopSellingMenuItem[]
  categorySales?: CategorySalesShare[]
  isLoading: boolean
}

const topMenusChartConfig = {
  qty_sold: {
    label: 'Porsi Terjual',
    color: '#6366f1',
  },
} satisfies ChartConfig

const categoryChartConfig = {
  total_revenue: {
    label: 'Total Penjualan',
    color: '#06b6d4',
  },
} satisfies ChartConfig

const CATEGORY_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']

export function MenuPerformanceCharts({
  topMenus,
  categorySales,
  isLoading,
}: MenuPerformanceChartsProps) {
  if (isLoading || !topMenus || !categorySales) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-1 h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[320px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-1 h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[320px] w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Sorter and reversed for horizontal layout (top 1 at the top of vertical chart)
  const sortedTopMenus = [...topMenus].reverse()

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Top 10 Menus Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Top Menu Terlaris</CardTitle>
          <CardDescription>
            Peringkat menu paling banyak dipesan dalam periode terpilih
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topMenus.length === 0 ? (
            <div className="text-muted-foreground flex h-[320px] items-center justify-center text-sm">
              Belum ada data pesanan pada periode ini
            </div>
          ) : (
            <ChartContainer config={topMenusChartConfig} className="h-[340px] w-full">
              <BarChart
                layout="vertical"
                data={sortedTopMenus}
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="menu_name"
                  tickLine={false}
                  axisLine={false}
                  width={100}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(val, _name, item) => (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            {val} porsi
                          </span>
                          <span className="text-muted-foreground text-[11px]">
                            Omzet: {formatRupiah(item.payload.total_revenue)}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Bar dataKey="qty_sold" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Category Share Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Penjualan per Kategori</CardTitle>
          <CardDescription>Kontribusi omzet dan jumlah porsi tiap kategori produk</CardDescription>
        </CardHeader>
        <CardContent>
          {categorySales.length === 0 ? (
            <div className="text-muted-foreground flex h-[320px] items-center justify-center text-sm">
              Belum ada data kategori
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <ChartContainer config={categoryChartConfig} className="h-[230px] w-full">
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(val, _name, item) => (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold">{formatRupiah(Number(val))}</span>
                            <span className="text-muted-foreground text-[11px]">
                              {item.payload.percentage}% dari total omzet
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Pie
                    data={categorySales}
                    dataKey="total_revenue"
                    nameKey="category_name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {categorySales.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>

              {/* Category Badges and Legend List */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {categorySales.map((cat, idx) => (
                  <div
                    key={cat.category_id}
                    className="flex items-center justify-between rounded-md border p-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
                        }}
                      />
                      <span className="font-medium">{cat.category_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{cat.percentage}%</span>
                      <Badge variant="outline" className="text-[10px]">
                        {formatRupiah(cat.total_revenue)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
