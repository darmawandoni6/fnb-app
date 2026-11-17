import { useState } from 'react'

import type { ReportDatePreset, ReportFilter } from '@/types'
import { BarChart3, Calendar, Layers, ReceiptText } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MenuPerformanceCharts } from '@/features/reports/MenuPerformanceCharts'
import { ReportKpiCards } from '@/features/reports/ReportKpiCards'
import { SalesTrendChart } from '@/features/reports/SalesTrendChart'
import { TransactionHistoryTab } from '@/features/reports/TransactionHistoryTab'
import {
  getDatesForPreset,
  useCategorySales,
  useSalesReportSummary,
  useSalesTrends,
  useTopSellingMenus,
} from '@/features/reports/useReports'

export function ReportsPage() {
  const [preset, setPreset] = useState<ReportDatePreset>('last_7_days')

  const filter: ReportFilter = {
    preset,
    ...getDatesForPreset(preset),
  }

  const { data: summary, isLoading: isLoadingSummary } = useSalesReportSummary(filter)
  const { data: trends, isLoading: isLoadingTrends } = useSalesTrends(filter)
  const { data: topMenus, isLoading: isLoadingTopMenus } = useTopSellingMenus(filter, 10)
  const { data: categorySales, isLoading: isLoadingCategories } = useCategorySales(filter)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Laporan & Analitik</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Pantau ringkasan performa omzet, tren transaksi, dan menu terlaris.
          </p>
        </div>

        {/* Global Preset Selector */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Calendar className="text-muted-foreground h-4 w-4" />
          <Select value={preset} onValueChange={(val) => setPreset(val as ReportDatePreset)}>
            <SelectTrigger className="w-[160px] text-xs">
              <SelectValue placeholder="Pilih Periode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hari Ini</SelectItem>
              <SelectItem value="last_7_days">7 Hari Terakhir</SelectItem>
              <SelectItem value="last_30_days">30 Hari Terakhir</SelectItem>
              <SelectItem value="this_month">Bulan Ini</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Tabbed View */}
      <Tabs defaultValue="summary" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="summary" className="gap-2 text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Ringkasan &</span> Tren
          </TabsTrigger>
          <TabsTrigger value="menus" className="gap-2 text-xs sm:text-sm">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Performa</span> Menu & Kategori
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-2 text-xs sm:text-sm">
            <ReceiptText className="h-4 w-4" />
            Riwayat Transaksi
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Ringkasan & Tren Penjualan */}
        <TabsContent value="summary" className="space-y-6">
          <ReportKpiCards summary={summary} isLoading={isLoadingSummary} />
          <SalesTrendChart data={trends} isLoading={isLoadingTrends} />
        </TabsContent>

        {/* Tab 2: Performa Menu & Kategori */}
        <TabsContent value="menus" className="space-y-6">
          <MenuPerformanceCharts
            topMenus={topMenus}
            categorySales={categorySales}
            isLoading={isLoadingTopMenus || isLoadingCategories}
          />
        </TabsContent>

        {/* Tab 3: Riwayat Transaksi */}
        <TabsContent value="transactions" className="space-y-6">
          <TransactionHistoryTab filter={filter} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
