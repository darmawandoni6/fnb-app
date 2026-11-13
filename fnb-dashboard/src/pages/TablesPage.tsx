import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import type { Table as CafeTable } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { Copy, CopyCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { toastApiError } from '@/lib/errors'

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type TableValues, tableSchema } from '@/features/tables/tableSchema'

export function TablesPage() {
  const queryClient = useQueryClient()
  const { data: tables } = useQuery({ queryKey: ['tables'], queryFn: api.getTables })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tables'] })

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Tables</h1>
        <TableFormDialog onSaved={invalidate} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nomor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>QR Token</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(tables ?? []).map((table) => (
            <TableRow key={table.id}>
              <TableCell className="font-medium">Meja {table.number}</TableCell>
              <TableCell>
                <Badge variant={table.is_active ? 'default' : 'secondary'}>
                  {table.is_active ? 'Aktif' : 'Nonaktif'}
                </Badge>
              </TableCell>
              <TableCell>
                <CopyToken token={table.qr_token} />
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                <TableFormDialog editing={table} onSaved={invalidate} />
                <DeactivateTableButton table={table} onDone={invalidate} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CopyToken({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="flex items-center gap-1 text-sm"
      onClick={async () => {
        await navigator.clipboard.writeText(token)
        setCopied(true)
        toast.success('Token disalin')
        window.setTimeout(() => setCopied(false), 1500)
      }}
    >
      <span className="max-w-40 truncate font-mono">{token}</span>
      {copied ? <CopyCheck className="size-4" /> : <Copy className="size-4" />}
    </button>
  )
}

function TableFormDialog({ editing, onSaved }: { editing?: CafeTable; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const form = useForm<TableValues>({
    resolver: zodResolver(tableSchema),
    defaultValues: { number: editing?.number ?? '' },
  })
  const mutation = useMutation({
    mutationFn: (values: TableValues) =>
      editing ? api.updateTable(editing.id, values) : api.createTable(values),
    onSuccess: () => {
      toast.success(editing ? 'Meja diperbarui' : 'Meja dibuat')
      setOpen(false)
      onSaved()
    },
    onError: toastApiError,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {editing ? 'Edit' : '+ Meja'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Meja' : 'Meja Baru'}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="table-number">Nomor</Label>
            <Input id="table-number" {...form.register('number')} />
            {form.formState.errors.number && (
              <p className="text-destructive text-sm">{form.formState.errors.number.message}</p>
            )}
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

function DeactivateTableButton({ table, onDone }: { table: CafeTable; onDone: () => void }) {
  const deactivate = useMutation({
    mutationFn: () => api.deleteTable(table.id),
    onSuccess: () => {
      toast.success('Meja dinonaktifkan')
      onDone()
    },
    onError: toastApiError,
  })

  if (!table.is_active) return null

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          Nonaktifkan
        </Button>
      }
      title="Nonaktifkan meja?"
      description="Meja nonaktif tidak bisa dipakai order QR baru."
      onConfirm={() => deactivate.mutate()}
      pending={deactivate.isPending}
    />
  )
}
