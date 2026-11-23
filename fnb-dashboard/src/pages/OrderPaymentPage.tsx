import { useEffect, useState } from 'react'

import { useNavigate, useParams } from 'react-router-dom'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, subscribeOrder, unsubscribeOrder } from '@/api'
import { ITEM_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, type PaymentMethod } from '@/constants'
import type { Order } from '@/types'
import { ArrowLeft, Banknote, CheckCircle2, CreditCard, Printer, UserCheck } from 'lucide-react'
import { toast } from 'sonner'

import { ROUTES } from '@/constants/routes'
import { formatRupiah, formatTime } from '@/lib/format'

import { useAuth } from '@/auth/context'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PaymentReceiptDialog } from '@/features/manual-order/PaymentReceiptDialog'
import { CancelOrderButton } from '@/features/orders/CancelOrderButton'
import { CashCountdown } from '@/features/orders/CashCountdown'

export function OrderPaymentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PAYMENT_METHOD.CASH)
  const [cashReceivedInput, setCashReceivedInput] = useState<string>('')
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null)
  const [backConfirmOpen, setBackConfirmOpen] = useState(false)

  const {
    data: order,
    isLoading,
    refetch,
  } = useQuery<Order>({
    queryKey: ['orders', id],
    queryFn: () => api.getOrder(id!),
    enabled: !!id,
  })

  useEffect(() => {
    if (!id) return
    subscribeOrder(id)
    return () => unsubscribeOrder(id)
  }, [id])
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings })
  const timeoutMinutes = settings?.cash_timeout_minutes ?? 0

  const totalAmount = order?.total_amount ?? 0
  const cashReceived = Number(cashReceivedInput.replace(/\D/g, '')) || 0
  const changeAmount = Math.max(0, cashReceived - totalAmount)
  const isCashInsufficient = paymentMethod === PAYMENT_METHOD.CASH && cashReceived < totalAmount

  const updatePaymentMutation = useMutation({
    mutationFn: (body: {
      payment_method: PaymentMethod
      amount_received?: number | null
      change_amount?: number | null
    }) => api.updatePayment(id!, body),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['orders', id] })
      toast.success(`Pembayaran pesanan ${updated.order_number} berhasil dicatat LUNAS`)
      setCompletedOrder(updated)
      setReceiptOpen(true)
    },
    onError: (error) => {
      toast.error((error as { message?: string }).message ?? 'Gagal memproses pembayaran')
    },
  })

  const handleQuickCash = (amount: number) => {
    setCashReceivedInput(String(amount))
  }

  const handleSettlePayment = () => {
    if (!order) return
    if (isCashInsufficient) {
      toast.error('Uang tunai yang diterima masih kurang dari total tagihan')
      return
    }

    const isCash = paymentMethod === PAYMENT_METHOD.CASH
    updatePaymentMutation.mutate({
      payment_method: paymentMethod,
      amount_received: isCash ? cashReceived : null,
      change_amount: isCash ? changeAmount : null,
    })
  }

  if (isLoading || !order) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Skeleton className="h-96 lg:col-span-7 xl:col-span-8" />
          <Skeleton className="h-96 lg:col-span-5 xl:col-span-4" />
        </div>
      </div>
    )
  }

  const isAlreadyPaid = order.payment_status === PAYMENT_STATUS.LUNAS
  const canCancelOrder =
    (user?.role === 'OWNER' || user?.role === 'CASHIER') &&
    !isAlreadyPaid &&
    order.status === 'MENUNGGU' &&
    order.items.some((item) => item.status !== ITEM_STATUS.CANCELLED)
  const goBackToNewOrder = () => {
    if (isAlreadyPaid) {
      navigate(ROUTES.ORDERS_NEW)
      return
    }
    setBackConfirmOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Top Navigation */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={goBackToNewOrder}
            className="text-muted-foreground hover:text-foreground h-8 gap-1.5 px-2 text-xs"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Order Baru</span>
          </Button>
          <div className="bg-border h-4 w-px" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">Pembayaran Pesanan</h1>
            <p className="text-muted-foreground text-xs">
              Periksa ringkasan dan selesaikan pembayaran pelanggan.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAlreadyPaid && (
            <Badge className="gap-1 bg-emerald-600 text-xs text-white">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Pesanan Sudah Lunas
            </Badge>
          )}
          {isAlreadyPaid && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setReceiptOpen(true)}
            >
              <Printer className="h-3.5 w-3.5" />
              Cetak Ulang Struk
            </Button>
          )}
          {canCancelOrder && <CancelOrderButton order={order} />}
        </div>
      </div>

      {/* Main Grid: Order Preview (Left) & Payment Methods (Right) */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left Column: Order Summary Preview */}
        <div className="space-y-4 lg:col-span-7 xl:col-span-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold">Ringkasan Pesanan</CardTitle>
                <Badge variant="outline" className="font-mono text-xs">
                  {order.order_number}
                </Badge>
                {!isAlreadyPaid && timeoutMinutes > 0 && (
                  <CashCountdown
                    createdAt={order.created_at}
                    timeoutMinutes={timeoutMinutes}
                    onExpire={refetch}
                  />
                )}
              </div>
              <CardDescription className="text-xs">
                {order.created_at.slice(0, 10)} · {formatTime(order.created_at)}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 text-xs">
              {/* Order Meta Info */}
              <div className="bg-muted/50 space-y-1 rounded-lg p-2.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pelanggan:</span>
                  <span className="text-foreground font-semibold">
                    {order.customer_name ?? 'Pelanggan'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Layanan:</span>
                  <span className="text-foreground font-medium">
                    {order.order_type === 'TAKE_AWAY'
                      ? 'Take Away (Bungkus)'
                      : `Dine In (Meja ${order.table_number ?? '-'})`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kasir Bertugas:</span>
                  <span className="text-foreground flex items-center gap-1 font-medium">
                    <UserCheck className="text-primary h-3 w-3" />
                    {order.created_by_name || user?.name || 'Kasir'}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between border-b pb-1.5 last:border-none"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-foreground line-clamp-1 font-semibold">
                        {item.menu_name_snapshot}
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        {item.qty}x @ {formatRupiah(item.price)}
                      </p>
                      {item.note && (
                        <p className="text-muted-foreground text-[10px] italic">
                          Catatan: {item.note}
                        </p>
                      )}
                    </div>
                    <span className="text-foreground shrink-0 font-medium">
                      {formatRupiah(item.qty * item.price)}
                    </span>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-1 pt-1">
                <div className="text-muted-foreground flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatRupiah(order.subtotal_amount)}</span>
                </div>
                <div className="text-muted-foreground flex justify-between">
                  <span>Service ({order.service_rate_snapshot}%)</span>
                  <span>{formatRupiah(order.service_amount)}</span>
                </div>
                <div className="text-muted-foreground flex justify-between">
                  <span>Pajak ({order.tax_rate_snapshot}%)</span>
                  <span>{formatRupiah(order.tax_amount)}</span>
                </div>
                <div className="text-foreground flex justify-between pt-1 text-base font-bold">
                  <span>Total Tagihan</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {formatRupiah(order.total_amount)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Payment Settlement Action */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:col-span-5 xl:col-span-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Pilih Pembayaran</CardTitle>
              <CardDescription className="text-xs">
                Pilih metode pembayaran yang digunakan oleh pelanggan.
              </CardDescription>
            </CardHeader>

            <CardContent
              className="space-y-4"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleSettlePayment()
                }
              }}
            >
              <Tabs
                defaultValue={PAYMENT_METHOD.CASH}
                onValueChange={(val) => setPaymentMethod(val as PaymentMethod)}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value={PAYMENT_METHOD.CASH} className="gap-2 text-xs">
                    <Banknote className="h-4 w-4" />
                    Tunai (Cash)
                  </TabsTrigger>
                  <TabsTrigger value={PAYMENT_METHOD.NON_CASH} className="gap-2 text-xs">
                    <CreditCard className="h-4 w-4" />
                    Non-Tunai
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Tunai */}
                <TabsContent value={PAYMENT_METHOD.CASH} className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cash-input" className="text-xs font-semibold">
                      Uang Diterima (Rp) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="cash-input"
                      autoFocus
                      type="text"
                      inputMode="numeric"
                      placeholder="Masukkan nominal uang yang diterima..."
                      value={
                        cashReceivedInput ? Number(cashReceivedInput).toLocaleString('id-ID') : ''
                      }
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '')
                        setCashReceivedInput(raw)
                      }}
                      className="h-10 font-mono text-base font-semibold"
                    />
                  </div>

                  {/* Quick Cash Buttons */}
                  <div className="space-y-1.5">
                    <span className="text-muted-foreground text-[11px] font-medium">
                      Pilihan Cepat Nominal:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickCash(totalAmount)}
                        className="h-8 text-xs font-semibold"
                      >
                        Uang Pas ({formatRupiah(totalAmount)})
                      </Button>
                      {[20000, 50000, 100000, 200000]
                        .filter((val) => val >= totalAmount)
                        .map((val) => (
                          <Button
                            key={val}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickCash(val)}
                            className="h-8 font-mono text-xs"
                          >
                            {formatRupiah(val)}
                          </Button>
                        ))}
                    </div>
                  </div>

                  {/* Change Calculation Box */}
                  <div className="rounded-lg border p-3 text-xs">
                    <div className="text-muted-foreground flex justify-between">
                      <span>Total Tagihan:</span>
                      <span>{formatRupiah(totalAmount)}</span>
                    </div>
                    <div className="text-muted-foreground flex justify-between">
                      <span>Uang Diterima:</span>
                      <span>{formatRupiah(cashReceived)}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span>Kembalian:</span>
                      <span
                        className={
                          isCashInsufficient
                            ? 'text-destructive'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }
                      >
                        {isCashInsufficient
                          ? `(Kurang ${formatRupiah(totalAmount - cashReceived)})`
                          : formatRupiah(changeAmount)}
                      </span>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 2: Non-Tunai */}
                <TabsContent value={PAYMENT_METHOD.NON_CASH} className="space-y-4 pt-4">
                  <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                    <p className="font-semibold">Konfirmasi Non-Tunai:</p>
                    <p className="mt-0.5 text-[11px]">
                      Pastikan dana sudah diterima lewat EDC atau mutasi rekening sebelum
                      menyelesaikan pesanan. Belum ada integrasi payment gateway.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Action Buttons */}
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={handleSettlePayment}
                  disabled={
                    updatePaymentMutation.isPending ||
                    isAlreadyPaid ||
                    (paymentMethod === PAYMENT_METHOD.CASH && isCashInsufficient)
                  }
                  className="h-11 w-full text-sm font-semibold"
                >
                  {updatePaymentMutation.isPending
                    ? 'Memproses Pembayaran...'
                    : isAlreadyPaid
                      ? 'Pesanan Sudah Lunas'
                      : `Selesaikan Pembayaran (${formatRupiah(totalAmount)})`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={backConfirmOpen} onOpenChange={setBackConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tinggalkan pembayaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Pesanan #{order.id} belum dibayar. Pesanan tetap tercatat dan bisa dibayar dari Order
              Board.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tetap di Sini</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate(ROUTES.ORDERS_NEW)}>
              Ya, ke Order Baru
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Printable Receipt Modal */}
      <PaymentReceiptDialog
        order={completedOrder ?? (isAlreadyPaid ? order : null)}
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        onNewOrder={() => navigate(ROUTES.ORDERS_NEW)}
        onBackToOrders={() => navigate(ROUTES.ORDERS)}
      />
    </div>
  )
}
