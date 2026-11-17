import { useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'

import { Skeleton } from '@/components/ui/skeleton'
import { PrintAllTablesDialog } from '@/features/tables/PrintAllTablesDialog'
import { TableCard } from '@/features/tables/TableCard'
import { TableFormDialog } from '@/features/tables/TableFormDialog'

export function TablesPage() {
  const queryClient = useQueryClient()
  const { data: tables, isLoading } = useQuery({ queryKey: ['tables'], queryFn: api.getTables })
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tables'] })
  const cafeName = settings?.cafe_name ?? 'Menu'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Tables</h1>
          <p className="text-muted-foreground text-xs">
            Kelola meja dan QR menu. Nonaktifkan meja untuk menolak order QR baru.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintAllTablesDialog tables={tables ?? []} cafeName={cafeName} />
          <TableFormDialog />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-52 w-full" />
          ))}
        </div>
      ) : (tables ?? []).length === 0 ? (
        <div className="text-muted-foreground flex h-56 flex-col items-center justify-center rounded-lg border border-dashed text-sm">
          Belum ada meja. Tambahkan meja untuk membuat QR menu.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(tables ?? []).map((table) => (
            <TableCard key={table.id} table={table} cafeName={cafeName} onChanged={invalidate} />
          ))}
        </div>
      )}
    </div>
  )
}
