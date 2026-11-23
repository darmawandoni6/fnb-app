import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import type { Settings } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Building2, CheckCircle2, Percent, Store, Timer } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { ORDER_STATUS } from '@/constants/orderStatus'
import { PAYMENT_STATUS } from '@/constants/paymentStatus'
import { toastApiError } from '@/lib/errors'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { type SettingsValues, settingsSchema } from '@/features/settings/settingsSchema'

const RATE_PRESETS = [
  { value: 0, label: '0%' },
  { value: 5, label: '5%' },
  { value: 10, label: '10%' },
  { value: 11, label: '11%' },
] as const

const closeDescription = (unpaidCount: number, processingCount: number) => {
  const parts = ['Pesanan baru dari QR dan Manual POS akan ditolak sampai toko dibuka kembali.']
  if (processingCount > 0) {
    parts.push(
      `${processingCount} pesanan masih DIPROSES (sudah dibayar). Selesaikan dulu — toko belum bisa ditutup.`,
    )
  }
  if (unpaidCount > 0) {
    parts.push(
      `${unpaidCount} pesanan belum dibayar akan otomatis dibatalkan dan stok dikembalikan.`,
    )
  }
  return parts.join(' ')
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { data: settings, isPending } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  })
  const { data: orders } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.getOrders(),
  })

  const mutation = useMutation({
    mutationFn: (values: Partial<Settings>) => api.updateSettings(values),
    onSuccess: (_, variables) => {
      if (variables.is_open !== undefined) {
        toast.success(
          variables.is_open
            ? 'Toko dibuka. Pesanan aktif diterima.'
            : 'Toko ditutup. Pesanan baru ditolak.',
        )
      } else {
        toast.success('Pengaturan toko berhasil disimpan')
      }
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: toastApiError,
  })

  const closeMutation = useMutation({
    mutationFn: api.closeStore,
    onSuccess: () => {
      toast.success('Toko ditutup. Pesanan belum dibayar dibatalkan.')
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
    },
    onError: (error) => {
      toastApiError(error)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  if (isPending || !settings) {
    return <SettingsSkeleton />
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Pengaturan Toko</h1>
        <p className="text-muted-foreground text-sm">
          Kelola status operasional, profil kafe, tarif biaya, dan timer pesanan.
        </p>
      </div>

      <StoreStatusCard
        isOpen={settings.is_open}
        isPending={mutation.isPending || closeMutation.isPending}
        unpaidCount={
          (orders ?? []).filter(
            (order) =>
              order.status === ORDER_STATUS.MENUNGGU &&
              order.payment_status === PAYMENT_STATUS.BELUM,
          ).length
        }
        processingCount={
          (orders ?? []).filter((order) => order.status === ORDER_STATUS.DIPROSES).length
        }
        onToggle={(isOpen) => mutation.mutate({ is_open: isOpen })}
        onClose={() => closeMutation.mutate()}
      />

      <StoreProfileForm
        key={`${settings.cafe_name}-${settings.service_rate}-${settings.tax_rate}`}
        defaultValues={{
          cafe_name: settings.cafe_name,
          service_rate: settings.service_rate,
          tax_rate: settings.tax_rate,
          cash_timeout_minutes: settings.cash_timeout_minutes,
          delivered_auto_complete_minutes: settings.delivered_auto_complete_minutes,
          ready_auto_deliver_minutes: settings.ready_auto_deliver_minutes,
          ready_auto_deliver_warning_minutes: settings.ready_auto_deliver_warning_minutes,
        }}
        isPending={mutation.isPending}
        onSave={(values) => mutation.mutate(values)}
      />
    </div>
  )
}

function StoreStatusCard({
  isOpen,
  isPending,
  unpaidCount,
  processingCount,
  onToggle,
  onClose,
}: {
  isOpen: boolean
  isPending: boolean
  unpaidCount: number
  processingCount: number
  onToggle: (isOpen: boolean) => void
  onClose: () => void
}) {
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)

  const handleCheckedChange = (checked: boolean) => {
    if (!checked) {
      // Menutup toko membutuhkan konfirmasi agar tidak terjadi salah klik
      setConfirmCloseOpen(true)
    } else {
      // Membuka toko langsung aktif instan
      onToggle(true)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-4 border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Store className="text-primary size-5" />
            <CardTitle className="text-base font-semibold">Status Operasional Toko</CardTitle>
          </div>
          <CardDescription>
            Menentukan apakah toko aktif melayani pesanan baru dari pelanggan dan kasir.
          </CardDescription>
        </div>
        <Badge
          variant="outline"
          className={
            isOpen
              ? 'border-emerald-500/30 bg-emerald-500/10 font-semibold text-emerald-700 dark:text-emerald-300'
              : 'border-destructive/30 bg-destructive/10 text-destructive font-semibold'
          }
        >
          {isOpen ? 'Toko Buka' : 'Toko Tutup'}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-4">
        <div className="bg-muted/40 flex items-center justify-between rounded-lg border p-3.5">
          <div className="space-y-0.5">
            <Label htmlFor="store-toggle" className="cursor-pointer text-sm font-medium">
              Buka / Tutup Operasional
            </Label>
            <p className="text-muted-foreground text-xs">
              {isOpen
                ? 'Geser untuk menutup operasional toko secara manual.'
                : 'Geser untuk kembali membuka penerimaan pesanan toko.'}
            </p>
          </div>
          <Switch
            id="store-toggle"
            checked={isOpen}
            disabled={isPending}
            onCheckedChange={handleCheckedChange}
          />
        </div>

        {/* Callout Info Kontekstual Aturan Bisnis */}
        {isOpen ? (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="space-y-1">
              <p className="font-semibold">Toko Sedang Aktif Menerima Pesanan</p>
              <p className="leading-relaxed opacity-90">
                Pesanan dari scan QR pelanggan dan Manual POS kasir aktif diterima. Demi keamanan
                stok berjalan, penambahan atau perubahan resep menu dikunci otomatis saat toko buka
                (PRD §8).
              </p>
            </div>
          </div>
        ) : (
          <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-start gap-3 rounded-lg border p-3 text-xs">
            <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold">Toko Sedang Tutup — Pesanan Ditolak</p>
              <p className="leading-relaxed opacity-90">
                Pemesanan baru dari QR dan kasir saat ini ditolak (error <code>STORE_CLOSED</code>).
                Anda dapat menambah atau memperbarui racikan resep menu dengan aman di halaman
                Menus.
              </p>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={confirmCloseOpen}
          onOpenChange={setConfirmCloseOpen}
          title="Tutup Operasional Toko?"
          description={closeDescription(unpaidCount, processingCount)}
          onConfirm={() => {
            setConfirmCloseOpen(false)
            onClose()
          }}
          pending={isPending}
        />
      </CardContent>
    </Card>
  )
}

function StoreProfileForm({
  defaultValues,
  isPending,
  onSave,
}: {
  defaultValues: SettingsValues
  isPending: boolean
  onSave: (values: SettingsValues) => void
}) {
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues,
  })

  const currentService = useWatch({ control: form.control, name: 'service_rate' })
  const currentTax = useWatch({ control: form.control, name: 'tax_rate' })

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <div className="flex items-center gap-2">
          <Building2 className="text-primary size-5" />
          <CardTitle className="text-base font-semibold">Profil Kafe & Biaya</CardTitle>
        </div>
        <CardDescription>
          Informasi ini tampil pada struk dan menjadi dasar perhitungan biaya layanan serta pajak
          transaksi baru.
        </CardDescription>
      </CardHeader>

      <form onSubmit={form.handleSubmit(onSave)}>
        <CardContent className="flex flex-col gap-5 pt-5">
          {/* Nama Kafe */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-cafe-name">
              Nama Kafe / Restoran <span className="text-destructive">*</span>
            </Label>
            <Input
              id="settings-cafe-name"
              placeholder="Contoh: Kopi Nusantara"
              {...form.register('cafe_name')}
            />
            {form.formState.errors.cafe_name && (
              <p className="text-destructive text-xs">{form.formState.errors.cafe_name.message}</p>
            )}
          </div>

          {/* Tarif service charge & pajak */}
          <div className="grid gap-4 sm:grid-cols-2">
            <RateField
              id="settings-service-rate"
              label="Service Charge"
              form={form}
              name="service_rate"
              current={currentService}
            />
            <RateField
              id="settings-tax-rate"
              label="Pajak Restoran (PB1 / PPN)"
              form={form}
              name="tax_rate"
              current={currentTax}
            />
          </div>

          {/* Timer pesanan */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Timer className="text-primary size-4" />
              <Label className="text-sm font-medium">Timer Pesanan (menit)</Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TimerField
                id="settings-cash-timeout"
                label="Timeout bayar tunai"
                form={form}
                name="cash_timeout_minutes"
              />
              <TimerField
                id="settings-auto-deliver"
                label="Auto-deliver (READY → DELIVERED)"
                form={form}
                name="ready_auto_deliver_minutes"
              />
              <TimerField
                id="settings-auto-deliver-warning"
                label="Peringatan auto-deliver"
                form={form}
                name="ready_auto_deliver_warning_minutes"
              />
              <TimerField
                id="settings-auto-complete"
                label="Auto-complete (DELIVERED → COMPLETED)"
                form={form}
                name="delivered_auto_complete_minutes"
              />
            </div>
            <p className="text-muted-foreground pt-0.5 text-xs">
              Penjadwal berjalan di server; dashboard hanya menampilkan status turunannya.
            </p>
          </div>

          <p className="text-muted-foreground text-xs">
            Tarif disalin ke setiap pesanan baru (snapshot) dan tidak mengubah pesanan lama (BR-12).
          </p>
        </CardContent>

        <CardFooter className="flex justify-end border-t pt-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

type FormLike = ReturnType<typeof useForm<SettingsValues>>

function RateField({
  id,
  label,
  form,
  name,
  current,
}: {
  id: string
  label: string
  form: FormLike
  name: 'service_rate' | 'tax_rate'
  current: number
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label} <span className="text-destructive">*</span>
      </Label>
      <div className="relative max-w-xs">
        <Input
          id={id}
          type="number"
          min={0}
          max={100}
          step="0.1"
          className="pr-9 font-mono"
          {...form.register(name, { valueAsNumber: true })}
        />
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm font-semibold">
          <Percent className="size-3.5" />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-muted-foreground mr-1 text-xs font-medium">Preset:</span>
        {RATE_PRESETS.map((preset) => (
          <Button
            key={preset.value}
            type="button"
            variant={current === preset.value ? 'secondary' : 'outline'}
            size="xs"
            className={current === preset.value ? 'border-primary/40 font-semibold' : ''}
            onClick={() => form.setValue(name, preset.value, { shouldValidate: true })}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      {form.formState.errors[name] && (
        <p className="text-destructive text-xs">{form.formState.errors[name]?.message}</p>
      )}
    </div>
  )
}

function TimerField({
  id,
  label,
  form,
  name,
}: {
  id: string
  label: string
  form: FormLike
  name:
    | 'cash_timeout_minutes'
    | 'delivered_auto_complete_minutes'
    | 'ready_auto_deliver_minutes'
    | 'ready_auto_deliver_warning_minutes'
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={1}
        className="h-9 font-mono"
        {...form.register(name, { valueAsNumber: true })}
      />
      {form.formState.errors[name] && (
        <p className="text-destructive text-xs">{form.formState.errors[name]?.message}</p>
      )}
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Card>
        <CardHeader className="border-b pb-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <Skeleton className="h-16 w-full rounded-lg" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-4">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-40" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
