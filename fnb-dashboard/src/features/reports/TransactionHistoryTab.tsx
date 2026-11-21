import { useState } from 'react'

import { ORDER_TYPE, PAYMENT_METHOD, PAYMENT_STATUS } from '@/constants'
import type { Order, ReportFilter } from '@/types'
import { Download, Eye } from 'lucide-react'
import { toast } from 'sonner'

import { formatRupiah, formatTime } from '@/lib/format'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { OrderDetailDialog } from '@/features/orders/OrderDetailDialog'

import { exportReportCsv } from './exportReportCsv'
import { useTransactionHistory } from './useReports'

type TransactionHistoryTabProps = {
  filter: ReportFilter
}

const PAGE_SIZE = 10

export function TransactionHistoryTab({ filter }: TransactionHistoryTabProps) {
  const [orderType, setOrderType] = useState<string>('ALL')
  const [paymentMethod, setPaymentMethod] = useState<string>('ALL')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const { data: transactions, isLoading } = useTransactionHistory({
    ...filter,
    order_type: orderType,
    payment_method: paymentMethod,
  })

  const list = transactions ?? []
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const paginatedList = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const handleExport = () => {
    if (list.length === 0) {
      toast.error('Tidak ada data transaksi untuk diekspor')
      return
    }
    exportReportCsv(list, filter.preset)
    toast.success(`Berhasil mengekspor ${list.length} transaksi ke CSV`)
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Riwayat Transaksi</CardTitle>
            <CardDescription>
              Daftar seluruh transaksi yang tercatat pada periode terpilih
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Order Type */}
            <Select
              value={orderType}
              onValueChange={(val) => {
                setOrderType(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="Tipe Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Tipe</SelectItem>
                <SelectItem value={ORDER_TYPE.DINE_IN}>Dine In</SelectItem>
                <SelectItem value={ORDER_TYPE.TAKE_AWAY}>Take Away</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter Payment Method */}
            <Select
              value={paymentMethod}
              onValueChange={(val) => {
                setPaymentMethod(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Metode Bayar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Metode</SelectItem>
                <SelectItem value={PAYMENT_METHOD.CASH}>Tunai (Cash)</SelectItem>
                <SelectItem value={PAYMENT_METHOD.NON_CASH}>Non-Tunai</SelectItem>
              </SelectContent>
            </Select>

            {/* Export CSV Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={isLoading || list.length === 0}
              className="h-8 gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Ekspor CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Skeleton key={idx} className="h-10 w-full" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>Tidak ada transaksi</EmptyTitle>
                <EmptyDescription>
                  Tidak ditemukan data transaksi untuk filter dan periode yang dipilih.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal & Jam</TableHead>
                      <TableHead>ID Pesanan</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Meja</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Metode Bayar</TableHead>
                      <TableHead className="text-right">Total (Rp)</TableHead>
                      <TableHead className="w-12 text-center">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedList.map((order) => {
                      const dateStr = order.created_at.slice(0, 10)
                      const timeStr = formatTime(order.created_at)

                      return (
                        <TableRow
                          key={order.id}
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <TableCell className="text-xs">
                            <span className="font-medium">{dateStr}</span>{' '}
                            <span className="text-muted-foreground">{timeStr}</span>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-medium">
                            {order.order_number}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                order.order_type === ORDER_TYPE.DINE_IN
                                  ? 'border-blue-500/40 text-blue-600 dark:text-blue-400'
                                  : 'border-orange-500/40 text-orange-600 dark:text-orange-400'
                              }
                            >
                              {order.order_type === ORDER_TYPE.DINE_IN ? 'Dine In' : 'Take Away'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {order.table_number ? `Meja ${order.table_number}` : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                order.payment_status === PAYMENT_STATUS.LUNAS
                                  ? 'default'
                                  : 'destructive'
                              }
                            >
                              {order.payment_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {order.payment_method === PAYMENT_METHOD.CASH
                              ? 'Tunai'
                              : order.payment_method === PAYMENT_METHOD.NON_CASH
                                ? 'Non-Tunai'
                                : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatRupiah(order.total_amount)}
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setSelectedOrder(order)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="sr-only">Lihat Detail</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination controls */}
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <div>
                  Menampilkan {(currentPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(currentPage * PAGE_SIZE, list.length)} dari {list.length} transaksi
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                  >
                    Sebelumnya
                  </Button>
                  <span>
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Dialog */}
      <OrderDetailDialog order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </>
  )
}
