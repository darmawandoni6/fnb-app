import { useQuery } from '@tanstack/react-query'

import { api } from '@/api'
import type { AuditLogEntry } from '@/types'

import { formatTime } from '@/lib/format'

import { DataTable, type DataTableColumn } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const columns: DataTableColumn<AuditLogEntry>[] = [
  {
    id: 'created_at',
    header: 'Waktu',
    accessorFn: (row) => `${row.created_at.slice(0, 10)} ${formatTime(row.created_at)}`,
    cell: ({ getValue }) => <span className="text-xs">{String(getValue())}</span>,
  },
  {
    accessorKey: 'entity',
    header: 'Entitas',
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.original.entity}/{row.original.entity_id}
      </span>
    ),
  },
  {
    accessorKey: 'action',
    header: 'Aksi',
    cell: ({ row }) => <Badge variant="outline">{row.original.action}</Badge>,
  },
  {
    id: 'transition',
    header: 'Perubahan',
    accessorFn: (row) => `${row.from_value ?? '-'} → ${row.to_value ?? '-'}`,
    cell: ({ getValue }) => <span className="text-xs">{String(getValue())}</span>,
  },
  {
    id: 'actor',
    header: 'Aktor',
    accessorFn: (row) => `${row.actor_role ?? '-'} (${row.actor_id ?? '-'})`,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground text-xs">{String(getValue())}</span>
    ),
  },
]

/** PRD §7.4: append-only audit trail, OWNER read-only. */
export function AuditLogPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-log'],
    queryFn: () => api.getAuditLog(),
  })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground text-xs">
          Jejak perubahan status pesanan, item, sesi meja, pembayaran, dan pengaturan toko.
        </p>
      </div>
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <DataTable columns={columns} data={data ?? []} empty="Belum ada catatan audit." />
      )}
    </div>
  )
}
