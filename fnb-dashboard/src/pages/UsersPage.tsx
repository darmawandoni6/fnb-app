import { type ReactNode, useCallback, useMemo, useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { USER_ROLE, type UserRole } from '@/constants'
import type { User } from '@/types'
import { cn } from 'cn'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ellipsis,
  Pencil,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react'
import { toast } from 'sonner'

import { toastApiError } from '@/lib/errors'

import { useAuth } from '@/auth/context'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable, type DataTableColumn, type DataTableInstance } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { UserFormDialog } from '@/features/users/UserFormDialog'

const ROLE_BADGE: Record<UserRole, { label: string; className: string }> = {
  [USER_ROLE.OWNER]: {
    label: 'Owner',
    className:
      'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold',
  },
  [USER_ROLE.CASHIER]: {
    label: 'Kasir',
    className: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  },
  [USER_ROLE.KITCHEN]: {
    label: 'Dapur',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
}

const CHIP_TONE = {
  neutral: 'ring-border bg-muted text-foreground',
  purple: 'ring-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300',
  blue: 'ring-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  amber: 'ring-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
} as const

type ChipTone = keyof typeof CHIP_TONE

function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: api.getUsers })

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    [queryClient],
  )

  const counts = useMemo(() => {
    const res = { all: users.length, owner: 0, cashier: 0, kitchen: 0 }
    for (const u of users) {
      if (u.role === USER_ROLE.OWNER) res.owner += 1
      if (u.role === USER_ROLE.CASHIER) res.cashier += 1
      if (u.role === USER_ROLE.KITCHEN) res.kitchen += 1
    }
    return res
  }, [users])

  const roleChips: {
    value: UserRole | 'all'
    label: string
    count: number
    tone: ChipTone
  }[] = [
    { value: 'all', label: 'Semua', count: counts.all, tone: 'neutral' },
    { value: USER_ROLE.OWNER, label: 'Owner', count: counts.owner, tone: 'purple' },
    { value: USER_ROLE.CASHIER, label: 'Kasir', count: counts.cashier, tone: 'blue' },
    { value: USER_ROLE.KITCHEN, label: 'Dapur', count: counts.kitchen, tone: 'amber' },
  ]

  const columns = useMemo<DataTableColumn<User>[]>(
    () => [
      {
        accessorKey: 'name',
        filterFn: 'includesString',
        header: ({ column }) => (
          <SortHeader
            sorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Nama Staf
          </SortHeader>
        ),
        cell: ({ row }) => {
          const user = row.original
          const isSelf = user.id === currentUser?.id
          return (
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold tracking-wider">
                {getUserInitials(user.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-foreground truncate font-medium">{user.name}</span>
                  {isSelf && (
                    <Badge
                      variant="outline"
                      className="border-primary/40 bg-primary/10 text-primary h-4 px-1.5 text-[10px] font-semibold"
                    >
                      Anda
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'email',
        filterFn: 'includesString',
        header: ({ column }) => (
          <SortHeader
            sorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Email Kredensial
          </SortHeader>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs">{row.original.email}</span>
        ),
      },
      {
        accessorKey: 'role',
        filterFn: 'equalsString',
        header: 'Role / Peran',
        cell: ({ row }) => {
          const roleConfig = ROLE_BADGE[row.original.role]
          return (
            <Badge variant="outline" className={roleConfig.className}>
              {roleConfig.label}
            </Badge>
          )
        },
      },
      {
        id: 'status',
        accessorFn: (row) => (row.is_active ? 'active' : 'inactive'),
        filterFn: 'equalsString',
        header: 'Status Akun',
        cell: ({ row }) => {
          const isActive = row.original.is_active
          return (
            <Badge
              variant="outline"
              className={
                isActive
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-muted-foreground/30 bg-muted text-muted-foreground'
              }
            >
              {isActive ? 'Aktif' : 'Nonaktif'}
            </Badge>
          )
        },
      },
      {
        id: 'actions',
        enableSorting: false,
        header: () => <span className="sr-only">Aksi</span>,
        cell: ({ row }) => (
          <UserActions
            user={row.original}
            isSelf={row.original.id === currentUser?.id}
            onSaved={invalidate}
          />
        ),
      },
    ],
    [currentUser?.id, invalidate],
  )

  const toolbar = (table: DataTableInstance<User>) => {
    const nameColumn = table.getColumn('name')
    const roleColumn = table.getColumn('role')
    const activeRole = (roleColumn?.getFilterValue() as UserRole | undefined) ?? 'all'

    return (
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Cari nama staf…"
          value={(nameColumn?.getFilterValue() as string | undefined) ?? ''}
          onChange={(event) => nameColumn?.setFilterValue(event.target.value)}
          className="sm:max-w-64"
        />
        <div className="flex flex-wrap gap-1">
          {roleChips.map((chip) => (
            <FilterChip
              key={chip.value}
              tone={chip.tone}
              count={chip.count}
              active={activeRole === chip.value}
              onClick={() =>
                roleColumn?.setFilterValue(chip.value === 'all' ? undefined : chip.value)
              }
            >
              {chip.label}
            </FilterChip>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg">Manajemen User & Staf</CardTitle>
            <CardDescription>
              Kelola akun staf kasir, staf dapur, serta hak akses dan status keaktifan mereka.
            </CardDescription>
          </div>
          <UserFormDialog onSaved={invalidate} />
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={users}
            toolbar={toolbar}
            empty="Tidak ada staf yang sesuai dengan filter."
          />
        </CardContent>
      </Card>
    </div>
  )
}

function FilterChip({
  active,
  tone = 'neutral',
  count,
  onClick,
  children,
}: {
  active: boolean
  tone?: ChipTone
  count?: number
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      size="xs"
      variant="ghost"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'font-medium',
        active ? cn('ring-1', CHIP_TONE[tone]) : 'text-muted-foreground',
      )}
    >
      {children}
      {count !== undefined && <span className="tabular-nums opacity-70">({count})</span>}
    </Button>
  )
}

function SortHeader({
  sorted,
  onToggle,
  children,
}: {
  sorted: false | 'asc' | 'desc'
  onToggle: () => void
  children: ReactNode
}) {
  const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <Button type="button" variant="ghost" size="xs" className="-ml-2" onClick={onToggle}>
      {children}
      <Icon className={cn('size-3', !sorted && 'text-muted-foreground')} />
    </Button>
  )
}

function UserActions({
  user,
  isSelf,
  onSaved,
}: {
  user: User
  isSelf: boolean
  onSaved: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [confirmToggleOpen, setConfirmToggleOpen] = useState(false)

  const toggleMutation = useMutation({
    mutationFn: () => api.updateUser(user.id, { is_active: !user.is_active }),
    onSuccess: () => {
      toast.success(user.is_active ? 'Akun staf dinonaktifkan' : 'Akun staf berhasil diaktifkan')
      setConfirmToggleOpen(false)
      onSaved()
    },
    onError: toastApiError,
  })

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${user.name}`}>
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="mr-2 size-4" />
            Edit staf
          </DropdownMenuItem>

          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={
                  user.is_active
                    ? 'text-destructive focus:text-destructive'
                    : 'text-emerald-600 focus:text-emerald-600'
                }
                onSelect={() => setConfirmToggleOpen(true)}
              >
                {user.is_active ? (
                  <>
                    <UserX className="mr-2 size-4" />
                    Nonaktifkan akun
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 size-4" />
                    Aktifkan akun
                  </>
                )}
              </DropdownMenuItem>
            </>
          )}

          {isSelf && (
            <>
              <DropdownMenuSeparator />
              <div className="text-muted-foreground flex items-center px-2 py-1.5 text-xs">
                <ShieldCheck className="mr-1.5 size-3.5" />
                Akun aktif Anda
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <UserFormDialog editing={user} open={editOpen} onOpenChange={setEditOpen} onSaved={onSaved} />

      {!isSelf && (
        <ConfirmDialog
          open={confirmToggleOpen}
          onOpenChange={setConfirmToggleOpen}
          title={user.is_active ? `Nonaktifkan akun ${user.name}?` : `Aktifkan akun ${user.name}?`}
          description={
            user.is_active
              ? `Staf (${user.role}) tidak akan bisa masuk/login ke dashboard sampai diaktifkan kembali.`
              : `Staf (${user.role}) akan dapat kembali login menggunakan kredensial email mereka.`
          }
          onConfirm={() => toggleMutation.mutate()}
          pending={toggleMutation.isPending}
        />
      )}
    </div>
  )
}
