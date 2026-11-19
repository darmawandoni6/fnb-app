import { useEffect, useMemo, useState } from 'react'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { USER_ROLE } from '@/constants'
import type { User } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { toastApiError } from '@/lib/errors'

import { useAuth } from '@/auth/context'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CreateUserValues } from '@/features/users/userSchemas'

type UserFormDialogProps = {
  editing?: User
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSaved?: () => void
}

type FormValues = {
  name: string
  email: string
  role: typeof USER_ROLE.CASHIER | typeof USER_ROLE.KITCHEN
  password?: string
}

export function UserFormDialog({
  editing,
  open: controlledOpen,
  onOpenChange,
  onSaved,
}: UserFormDialogProps) {
  const { user: currentUser } = useAuth()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const [showPassword, setShowPassword] = useState(false)
  const queryClient = useQueryClient()

  const isEditing = Boolean(editing)
  const isEditingSelf = editing?.id === currentUser?.id
  const isEditingOwner = editing?.role === USER_ROLE.OWNER

  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().min(1, 'Nama wajib diisi'),
          email: z.string().email('Format email tidak valid'),
          role: z.enum([USER_ROLE.CASHIER, USER_ROLE.KITCHEN]),
          password: z.string().optional().or(z.literal('')),
        })
        .superRefine((data, ctx) => {
          if (!isEditing) {
            if (!data.password || data.password.length < 8) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['password'],
                message: 'Password minimal 8 karakter',
              })
            }
          } else if (data.password && data.password.length > 0 && data.password.length < 8) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['password'],
              message: 'Password minimal 8 karakter',
            })
          }
        }),
    [isEditing],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: editing?.name ?? '',
      email: editing?.email ?? '',
      role: editing?.role === USER_ROLE.KITCHEN ? USER_ROLE.KITCHEN : USER_ROLE.CASHIER,
      password: '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: editing?.name ?? '',
        email: editing?.email ?? '',
        role: editing?.role === USER_ROLE.KITCHEN ? USER_ROLE.KITCHEN : USER_ROLE.CASHIER,
        password: '',
      })
      setShowPassword(false)
    }
  }, [open, editing, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (editing) {
        const payload: { name: string; role?: typeof values.role; password?: string } = {
          name: values.name,
        }
        if (!isEditingOwner && !isEditingSelf) {
          payload.role = values.role
        }
        if (values.password && values.password.trim().length > 0) {
          payload.password = values.password
        }
        return api.updateUser(editing.id, payload)
      }
      return api.createUser(values as CreateUserValues)
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Data staf diperbarui' : 'Staf baru berhasil ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setOpen(false)
      form.reset()
      onSaved?.()
    },
    onError: toastApiError,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button size="sm">+ User</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit Staf: ${editing?.name}` : 'Tambah Staf Baru'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Perbarui nama, penugasan role, atau kata sandi staf.'
              : 'Tambahkan akun staf kasir atau dapur untuk mengakses operasional toko.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          {/* Nama */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-form-name">
              Nama Lengkap <span className="text-destructive">*</span>
            </Label>
            <Input
              id="user-form-name"
              placeholder="Contoh: Siti Rahma"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-form-email">
              Alamat Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="user-form-email"
              type="email"
              placeholder="contoh@resto.id"
              disabled={isEditing}
              {...form.register('email')}
            />
            {isEditing ? (
              <p className="text-muted-foreground text-xs">
                Email digunakan untuk kredensial login dan tidak dapat diubah.
              </p>
            ) : form.formState.errors.email ? (
              <p className="text-destructive text-xs">{form.formState.errors.email.message}</p>
            ) : null}
          </div>

          {/* Role */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-form-role">
              Peran / Role <span className="text-destructive">*</span>
            </Label>
            {isEditingOwner ? (
              <div className="bg-muted/50 text-muted-foreground flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="text-primary font-semibold">OWNER</span>
                <span className="text-xs">(Role pemilik toko tidak dapat diubah)</span>
              </div>
            ) : isEditingSelf ? (
              <div className="bg-muted/50 text-muted-foreground flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="font-semibold">{editing?.role}</span>
                <span className="text-xs">(Tidak dapat mengubah role akun Anda sendiri)</span>
              </div>
            ) : (
              <Select
                value={form.watch('role')}
                onValueChange={(val) =>
                  form.setValue('role', val as FormValues['role'], { shouldValidate: true })
                }
              >
                <SelectTrigger id="user-form-role">
                  <SelectValue placeholder="Pilih role staf" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={USER_ROLE.CASHIER}>
                    <div className="flex flex-col text-left">
                      <span className="font-medium text-blue-700 dark:text-blue-300">
                        Kasir (CASHIER)
                      </span>
                      <span className="text-muted-foreground text-xs">
                        Akses transaksi kasir, pembayaran, dan pesanan
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value={USER_ROLE.KITCHEN}>
                    <div className="flex flex-col text-left">
                      <span className="font-medium text-amber-700 dark:text-amber-300">
                        Dapur (KITCHEN)
                      </span>
                      <span className="text-muted-foreground text-xs">
                        Akses tampilan pesanan dapur & status masak
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
            {form.formState.errors.role && (
              <p className="text-destructive text-xs">{form.formState.errors.role.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="user-form-password">
                Kata Sandi{' '}
                {isEditing ? (
                  <span className="text-muted-foreground text-xs">(Opsional)</span>
                ) : (
                  <span className="text-destructive">*</span>
                )}
              </Label>
              {isEditing && (
                <span className="text-muted-foreground text-[11px]">
                  Kosongkan jika tidak diubah
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                id="user-form-password"
                type={showPassword ? 'text' : 'password'}
                placeholder={isEditing ? 'Masukkan kata sandi baru…' : 'Minimal 8 karakter'}
                className="pr-10"
                {...form.register('password')}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
            {form.formState.errors.password && (
              <p className="text-destructive text-xs">{form.formState.errors.password.message}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Batal
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Menyimpan…' : isEditing ? 'Simpan Perubahan' : 'Buat User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
