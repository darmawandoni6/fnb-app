import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Building2, CheckCircle2, Percent, Store } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

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

const TAX_PRESETS = [
  { value: 0, label: '0% (Tanpa Pajak)' },
  { value: 10, label: '10% (PB1 Reguler)' },
  { value: 11, label: '11% (PPN)' },
] as const

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { data: settings, isPending } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  })

  const mutation = useMutation({
    mutationFn: (values: Partial<SettingsValues>) => api.updateSettings(values),
    onSuccess: (_, variables: Partial<SettingsValues>) => {
      if (variables.is_open !== undefined) {
        toast.success(
          variables.is_open
            ? 'Toko dibuka. Pesanan aktif diterima.'
            : 'Toko ditutup. Pesanan baru ditolak.',
        )
      } else {
        toast.success('Pengaturan profil & pajak berhasil disimpan')
      }
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: toastApiError,
  })

  if (isPending || !settings) {
    return <SettingsSkeleton />
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Pengaturan Toko</h1>
        <p className="text-muted-foreground text-sm">
          Kelola status operasional, profil kafe, dan perhitungan tarif pajak transaksi.
        </p>
      </div>

      <StoreStatusCard
        isOpen={settings.is_open}
        isPending={mutation.isPending}
        onToggle={(isOpen) => mutation.mutate({ is_open: isOpen })}
      />

      <StoreProfileForm
        key={`${settings.cafe_name}-${settings.tax_percent}`}
        defaultValues={{
          cafe_name: settings.cafe_name,
          tax_percent: settings.tax_percent,
          is_open: settings.is_open,
        }}
        isPending={mutation.isPending}
        onSave={({ cafe_name, tax_percent }) => mutation.mutate({ cafe_name, tax_percent })}
      />
    </div>
  )
}

function StoreStatusCard({
  isOpen,
  isPending,
  onToggle,
}: {
  isOpen: boolean
  isPending: boolean
  onToggle: (isOpen: boolean) => void
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
          description="Seluruh pemesanan baru dari scan QR meja pelanggan dan Manual POS kasir akan otomatis ditolak sampai toko dibuka kembali. Pastikan semua antrean aktif telah selesai dilayani."
          onConfirm={() => {
            setConfirmCloseOpen(false)
            onToggle(false)
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
  onSave: (values: { cafe_name: string; tax_percent: number }) => void
}) {
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues,
  })

  const currentTax = useWatch({ control: form.control, name: 'tax_percent' })

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <div className="flex items-center gap-2">
          <Building2 className="text-primary size-5" />
          <CardTitle className="text-base font-semibold">Profil Kafe & Perhitungan Pajak</CardTitle>
        </div>
        <CardDescription>
          Informasi ini ditampilkan pada cetak struk pembayaran dan digunakan sebagai dasar
          perhitungan pajak transaksi.
        </CardDescription>
      </CardHeader>

      <form
        onSubmit={form.handleSubmit(({ cafe_name, tax_percent }) =>
          onSave({ cafe_name, tax_percent }),
        )}
      >
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
            <p className="text-muted-foreground text-xs">
              Nama ini akan dicetak di bagian paling atas struk kasir dan judul menu QR meja.
            </p>
            {form.formState.errors.cafe_name && (
              <p className="text-destructive text-xs">{form.formState.errors.cafe_name.message}</p>
            )}
          </div>

          {/* Persentase Pajak */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-tax-percent">
              Tarif Pajak Restoran (PB1 / PPN) <span className="text-destructive">*</span>
            </Label>
            <div className="relative max-w-xs">
              <Input
                id="settings-tax-percent"
                type="number"
                min={0}
                max={100}
                placeholder="0"
                className="pr-9 font-mono"
                {...form.register('tax_percent', { valueAsNumber: true })}
              />
              <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm font-semibold">
                <Percent className="size-3.5" />
              </span>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-muted-foreground mr-1 text-xs font-medium">Preset cepat:</span>
              {TAX_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  variant={currentTax === preset.value ? 'secondary' : 'outline'}
                  size="xs"
                  className={currentTax === preset.value ? 'border-primary/40 font-semibold' : ''}
                  onClick={() =>
                    form.setValue('tax_percent', preset.value, { shouldValidate: true })
                  }
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <p className="text-muted-foreground pt-0.5 text-xs">
              Tarif pajak disalin langsung ke setiap pesanan baru (snapshot historis) dan tidak
              mengubah pesanan lama.
            </p>
            {form.formState.errors.tax_percent && (
              <p className="text-destructive text-xs">
                {form.formState.errors.tax_percent.message}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-end border-t pt-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Menyimpan…' : 'Simpan Perubahan'}
          </Button>
        </CardFooter>
      </form>
    </Card>
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
