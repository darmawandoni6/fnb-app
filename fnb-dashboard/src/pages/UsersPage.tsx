import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import type { User } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { toastApiError } from '@/lib/errors'

import { useAuth } from '@/auth/context'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type CreateUserValues,
  type UpdateUserValues,
  createUserSchema,
  updateUserSchema,
} from '@/features/users/userSchemas'

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: api.getUsers })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Users</h1>
        <CreateUserDialog onSaved={invalidate} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(users ?? []).map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <Badge variant="outline">{user.role}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={user.is_active ? 'default' : 'secondary'}>
                  {user.is_active ? 'Aktif' : 'Nonaktif'}
                </Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                <EditUserDialog user={user} onSaved={invalidate} />
                {user.id !== currentUser?.id && (
                  <ToggleUserButton user={user} onDone={invalidate} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CreateUserDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: '', email: '', role: 'CASHIER' },
  })
  const mutation = useMutation({
    mutationFn: (values: CreateUserValues) => api.createUser(values),
    onSuccess: () => {
      toast.success('User dibuat')
      setOpen(false)
      onSaved()
    },
    onError: toastApiError,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ User</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>User Baru</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="user-name">Nama</Label>
            <Input id="user-name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="user-email">Email</Label>
            <Input id="user-email" type="email" {...form.register('email')} />
            {form.formState.errors.email && (
              <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label>Role</Label>
            <Select
              defaultValue="CASHIER"
              onValueChange={(value) => form.setValue('role', value as CreateUserValues['role'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASHIER">CASHIER</SelectItem>
                <SelectItem value="KITCHEN">KITCHEN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditUserDialog({ user, onSaved }: { user: User; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const form = useForm<UpdateUserValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { name: user.name },
  })
  const mutation = useMutation({
    mutationFn: (values: UpdateUserValues) => api.updateUser(user.id, values),
    onSuccess: () => {
      toast.success('User diperbarui')
      setOpen(false)
      onSaved()
    },
    onError: toastApiError,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor={`user-name-${user.id}`}>Nama</Label>
            <Input id={`user-name-${user.id}`} {...form.register('name')} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ToggleUserButton({ user, onDone }: { user: User; onDone: () => void }) {
  const toggle = useMutation({
    mutationFn: () => api.updateUser(user.id, { is_active: !user.is_active }),
    onSuccess: () => {
      toast.success(user.is_active ? 'User dinonaktifkan' : 'User diaktifkan')
      onDone()
    },
    onError: toastApiError,
  })

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          {user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        </Button>
      }
      title={user.is_active ? 'Nonaktifkan user?' : 'Aktifkan user?'}
      description={
        user.is_active ? 'User nonaktif tidak bisa login.' : 'User akan bisa login kembali.'
      }
      onConfirm={() => toggle.mutate()}
      pending={toggle.isPending}
    />
  )
}
