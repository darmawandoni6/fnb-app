import type { Table, TableSession } from '@/types'

import { request } from '../client'

type ServerTable = {
  id: string
  table_number: string
  qr_token: string
  is_active: boolean
  created_at: string
  updated_at: string
}

type ServerTableSession = TableSession

const toTable = (t: ServerTable): Table => ({
  id: t.id,
  table_number: t.table_number,
  qr_token: t.qr_token,
  is_active: t.is_active,
})

const toTableSession = (s: ServerTableSession): TableSession => ({
  id: s.id,
  table_id: s.table_id,
  session_token: s.session_token,
  status: s.status,
  started_at: s.started_at,
  ended_at: s.ended_at,
  closed_by: s.closed_by,
})

export const getTables = () =>
  request<ServerTable[]>({ method: 'GET', url: '/tables' }).then((arr) => arr.map(toTable))

export const createTable = async ({ table_number }: { table_number: string }): Promise<Table> => {
  const tables = await request<ServerTable[]>({ method: 'GET', url: '/tables' })
  let qr_token: string
  do {
    qr_token = `qr-${crypto.randomUUID()}`
  } while (tables.some((t) => t.qr_token === qr_token))
  const table = await request<ServerTable>({
    method: 'POST',
    url: '/tables',
    data: { table_number, qr_token },
  })
  return toTable(table)
}

export const updateTable = async (
  id: string,
  body: { table_number?: string; is_active?: boolean },
): Promise<Table> => {
  const tables = await request<ServerTable[]>({ method: 'GET', url: '/tables' })
  const current = tables.find((t) => t.id === id)
  if (!current) throw new Error('Table not found')
  const table = await request<ServerTable>({
    method: 'PATCH',
    url: `/tables/${id}`,
    data: {
      table_number: current.table_number,
      qr_token: current.qr_token,
      is_active: current.is_active,
      ...body,
    },
  })
  return toTable(table)
}

export const deleteTable = async (id: string): Promise<void> => {
  await request<void>({ method: 'DELETE', url: `/tables/${id}` })
}

export const getTableSession = async (tableId: string): Promise<TableSession> => {
  const session = await request<ServerTableSession>({
    method: 'GET',
    url: `/tables/${tableId}/session`,
  })
  return toTableSession(session)
}

export const closeTableSession = async (tableId: string): Promise<TableSession> => {
  const session = await request<ServerTableSession>({
    method: 'POST',
    url: `/tables/${tableId}/session/close`,
  })
  return toTableSession(session)
}
