# Phase 3.5 (Dashboard) — Slicing Menu Reports (Mock Data)

Plan for PRD "Phase 3 — Insights" features, built against the mock layer (`src/api/`).

Goal: replace the Reports stub page (`StubPage`) with a complete, interactive Tabbed View reporting dashboard for role `OWNER`. Fully mocked with realistic 30-day historical seed data, so future API integration will only swap handlers.

## Scope

- **Global Preset Filter**: Dropdown in header (`today`, `last_7_days`, `last_30_days`, `this_month`).
- **Tab 1 — Ringkasan & Grafik Penjualan**:
  - 4 KPI cards: Total Revenue, Total Orders, Average Order Value (AOV), Proporsi Penjualan (Metode Bayar & Tipe Order).
  - Grafik Tren Penjualan dengan toggle: _Tren Pendapatan (Rp)_ (Area Chart) vs _Volume Pesanan_ (Bar Chart) menggunakan `shadcn/ui` Chart primitive berbasis `recharts`.
- **Tab 2 — Performa Menu & Kategori**:
  - Top 10 Menu Terlaris (Horizontal Bar Chart).
  - Kontribusi Penjualan per Kategori Menu (Bar / Pie Chart).
- **Tab 3 — Riwayat Transaksi**:
  - Filter lokal: Tipe Pesanan (Semua / QR / Manual) & Metode Pembayaran (Semua / Tunai / Non-Tunai).
  - Ekspor CSV client-side (`laporan-transaksi-[preset]-[tanggal].csv`).
  - Tabel riwayat transaksi dengan pagination dan empty state.

## Step 1 — Dependencies & Chart UI Primitive

1. Install `recharts` (versi 3.x, kompatibel React 19).
2. Buat `src/components/ui/chart.tsx` (shadcn chart wrapper: `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`).

## Step 2 — Types & Mock Handlers

1. **`src/types/report.ts`**:
   - `ReportDatePreset`: `'today' | 'last_7_days' | 'last_30_days' | 'this_month'`
   - `ReportFilter`: `{ preset: ReportDatePreset; from_date: string; to_date: string }`
   - `SalesReportSummary`: `{ total_revenue, total_orders, average_order_value, cash_revenue, non_cash_revenue, qr_orders_count, manual_orders_count, total_items_sold }`
   - `DailySalesTrend`: `{ date: string, revenue: number, order_count: number }`
   - `TopSellingMenuItem`: `{ menu_id, menu_name, category_name, qty_sold, total_revenue }`
   - `CategorySalesShare`: `{ category_id, category_name, total_revenue, total_items_sold, percentage }`
2. **`src/mocks/data/reports.ts`**:
   - Generator 30-hari data order historis realistis (weekend spike, variasi menu `db.menus`, variasi pembayaran).
3. **`src/mocks/handlers/reports.ts`**:
   - `getSalesReportSummary(filter)`
   - `getSalesTrends(filter)`
   - `getTopSellingMenus(filter, limit?)`
   - `getCategorySales(filter)`
   - `getTransactionHistory(filter)`

## Step 3 — Feature Layer (`src/features/reports/`)

1. `useReports.ts`: TanStack Query hooks untuk masing-masing query di atas.
2. `ReportKpiCards.tsx`: 4 kartu metrik utama.
3. `SalesTrendChart.tsx`: Area/Bar chart dengan tombol toggle metric.
4. `MenuPerformanceCharts.tsx`: Horizontal bar chart top 10 menus & perbandingan kategori.
5. `TransactionHistoryTab.tsx`: Tabel transaksi terfilter + pagination.
6. `exportReportCsv.ts`: Utilitas client-side download CSV.

## Step 4 — Page & Routes

1. `src/pages/ReportsPage.tsx`: Layout Tabbed View (Tabs: `"summary"`, `"menus"`, `"transactions"`).
2. `src/App.tsx`: Ganti `<StubPage title="Reports" />` dengan `<ReportsPage />`.

## Step 5 — Verification

```bash
export PATH="/home/doni/.nvm/versions/node/v24.22.1/bin:$PATH"
npm run lint
npm run format:check
npm run build
```
