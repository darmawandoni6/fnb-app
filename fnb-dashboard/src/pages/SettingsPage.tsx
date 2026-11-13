import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { toastApiError } from '@/lib/errors'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { type SettingsValues, settingsSchema } from '@/features/settings/settingsSchema'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings })
  const mutation = useMutation({
    mutationFn: (values: Partial<SettingsValues>) => api.updateSettings(values),
    onSuccess: () => {
      toast.success('Pengaturan disimpan')
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: toastApiError,
  })

  if (!settings) return null

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Settings</h1>
      <SettingsForm
        key={`${settings.cafe_name}-${settings.tax_percent}-${settings.is_open}`}
        defaultValues={settings}
        pending={mutation.isPending}
        onSave={(values) => mutation.mutate(values)}
        onToggleOpen={(is_open) => mutation.mutate({ is_open })}
      />
    </div>
  )
}

function SettingsForm({
  defaultValues,
  pending,
  onSave,
  onToggleOpen,
}: {
  defaultValues: { cafe_name: string; tax_percent: number; is_open: boolean }
  pending: boolean
  onSave: (values: { cafe_name: string; tax_percent: number }) => void
  onToggleOpen: (is_open: boolean) => void
}) {
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues,
  })
  const isOpen = form.watch('is_open')

  return (
    <div className="flex max-w-md flex-col gap-4">
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(({ cafe_name, tax_percent }) =>
          onSave({ cafe_name, tax_percent }),
        )}
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="cafe-name">Nama Kafe</Label>
          <Input id="cafe-name" {...form.register('cafe_name')} />
          {form.formState.errors.cafe_name && (
            <p className="text-destructive text-sm">{form.formState.errors.cafe_name.message}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="tax-percent">Pajak (%)</Label>
          <Input
            id="tax-percent"
            type="number"
            {...form.register('tax_percent', { valueAsNumber: true })}
          />
          {form.formState.errors.tax_percent && (
            <p className="text-destructive text-sm">{form.formState.errors.tax_percent.message}</p>
          )}
        </div>
        <Button type="submit" disabled={pending} className="w-fit">
          Simpan
        </Button>
      </form>
      <div className="flex flex-col gap-1 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="is-open">Toko Buka</Label>
          <Switch
            id="is-open"
            checked={isOpen}
            disabled={pending}
            onCheckedChange={(checked) => {
              form.setValue('is_open', checked)
              onToggleOpen(checked)
            }}
          />
        </div>
        <p className="text-muted-foreground text-sm">Toko tutup menolak order baru.</p>
        {!isOpen && <p className="text-destructive text-sm">Order baru sedang ditolak.</p>}
      </div>
    </div>
  )
}
