import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { PAYMENT_METHOD, PAYMENT_METHOD_LABEL } from '@/constants/paymentMethod'
import { type CheckoutInput, checkoutSchema } from '@/schemas/checkout'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CheckoutFormProps {
  disabled: boolean
  pending: boolean
  onSubmit: (input: CheckoutInput) => void
}

export function CheckoutForm({ disabled, pending, onSubmit }: CheckoutFormProps) {
  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { customerName: '', customerPhone: '', paymentMethod: PAYMENT_METHOD.CASH },
  })

  return (
    <form className="flex flex-col gap-3" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="customer-name">Nama pemesan</Label>
        <Input
          id="customer-name"
          placeholder="Nama Anda"
          disabled={disabled || pending}
          aria-invalid={Boolean(form.formState.errors.customerName)}
          {...form.register('customerName')}
        />
        {form.formState.errors.customerName && (
          <p className="text-destructive text-xs">{form.formState.errors.customerName.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="customer-phone">Nomor HP (opsional)</Label>
        <Input
          id="customer-phone"
          inputMode="tel"
          placeholder="08xxxxxxxxxx"
          disabled={disabled || pending}
          {...form.register('customerPhone')}
        />
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-text mb-1 text-sm font-medium">Metode pembayaran</legend>
        {Object.values(PAYMENT_METHOD).map((method) => (
          <label
            key={method}
            className="border-border flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm"
          >
            <input
              type="radio"
              value={method}
              disabled={disabled || pending}
              {...form.register('paymentMethod')}
            />
            <span>{PAYMENT_METHOD_LABEL[method]}</span>
          </label>
        ))}
        <p className="text-text-muted text-xs">
          Pembayaran non-tunai dilanjutkan di halaman pembayaran setelah pesanan dibuat.
        </p>
      </fieldset>

      <Button
        type="submit"
        className="h-12 w-full rounded-full text-base font-semibold"
        disabled={disabled || pending}
      >
        {pending ? 'Mengirim Pesanan...' : 'Pesan Sekarang'}
      </Button>
    </form>
  )
}
