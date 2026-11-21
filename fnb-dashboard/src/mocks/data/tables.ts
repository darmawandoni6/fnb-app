import type { Table, TableSession } from '@/types'

export const tables: Table[] = [
  { id: 'table-1', table_number: '1', qr_token: 'qr-table-1', is_active: true },
  { id: 'table-2', table_number: '2', qr_token: 'qr-table-2', is_active: true },
  { id: 'table-3', table_number: '3', qr_token: 'qr-table-3', is_active: true },
  { id: 'table-4', table_number: '4', qr_token: 'qr-table-4', is_active: false },
]

export const tableSessions: TableSession[] = [
  {
    id: 'session-1',
    table_id: 'table-1',
    session_token: 'session-token-table-1',
    status: 'OPEN',
    started_at: '2026-01-01T09:00:00.000Z',
    ended_at: null,
    closed_by: null,
  },
]
