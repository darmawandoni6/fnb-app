import { API_ERROR_CODE, ORDER_TYPE, USER_ROLE } from '@/constants'
import { db } from '@/mocks/db'
import type { Table, TableSession } from '@/types'

import { audit, delay, fail, findOrThrow, requireRole } from './shared'

export const getTables = async (): Promise<Table[]> => {
  await delay()
  return [...db.tables]
    .sort((a, b) => {
      const left = Number(a.table_number)
      const right = Number(b.table_number)
      if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right
      return a.table_number.localeCompare(b.table_number, 'id', { numeric: true })
    })
    .map((table) => ({ ...table }))
}

export const createTable = async ({ table_number }: { table_number: string }): Promise<Table> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  const trimmed = table_number.trim()
  if (!trimmed) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nomor meja wajib diisi')
  if (db.tables.some((table) => table.table_number.trim() === trimmed)) {
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nomor meja sudah ada')
  }
  const table: Table = {
    id: `table-${Date.now()}`,
    table_number: trimmed,
    qr_token: `qr-${crypto.randomUUID()}`,
    is_active: true,
  }
  db.tables.push(table)
  return { ...table }
}

export const updateTable = async (
  id: string,
  body: { table_number?: string; is_active?: boolean },
): Promise<Table> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  const table = findOrThrow(
    db.tables.find((candidate) => candidate.id === id),
    API_ERROR_CODE.NOT_FOUND,
    'Meja tidak ditemukan',
  )
  const targetTable = table!
  if (body.table_number !== undefined) {
    const trimmed = body.table_number.trim()
    if (!trimmed) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nomor meja wajib diisi')
    if (
      db.tables.some(
        (candidate) => candidate.id !== id && candidate.table_number.trim() === trimmed,
      )
    )
      fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nomor meja sudah ada')
    targetTable.table_number = trimmed
  }
  if (body.is_active !== undefined) targetTable.is_active = body.is_active
  return { ...targetTable }
}

export const deleteTable = async (id: string): Promise<void> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  const table = findOrThrow(
    db.tables.find((candidate) => candidate.id === id),
    API_ERROR_CODE.NOT_FOUND,
    'Meja tidak ditemukan',
  )
  table.is_active = false
}

/** PRD §4.6 / §9: read the open session of a table. */
export const getTableSession = async (tableId: string): Promise<TableSession> => {
  await delay()
  requireRole(USER_ROLE.CASHIER, USER_ROLE.OWNER)
  const session = db.tableSessions.find(
    (candidate) => candidate.table_id === tableId && candidate.status === 'OPEN',
  )
  return session ? { ...session } : fail(API_ERROR_CODE.NOT_FOUND, 'Tidak ada sesi meja yang aktif')
}

/** PRD §4.6: closing never touches the table's orders. */
export const closeTableSession = async (tableId: string): Promise<TableSession> => {
  await delay()
  const actor = requireRole(USER_ROLE.CASHIER, USER_ROLE.OWNER)
  const session = findOrThrow(
    db.tableSessions.find(
      (candidate) => candidate.table_id === tableId && candidate.status === 'OPEN',
    ),
    API_ERROR_CODE.NOT_FOUND,
    'Tidak ada sesi meja yang aktif',
  )
  session.status = 'CLOSED'
  session.ended_at = new Date().toISOString()
  session.closed_by = actor.id
  audit({
    entity: 'table_session',
    entity_id: session.id,
    action: 'session_closed',
    from_value: 'OPEN',
    to_value: 'CLOSED',
  })
  return { ...session }
}

export const getTableOrderType = (tableId: string) =>
  db.orders.some((order) => order.table_id === tableId && order.order_type === ORDER_TYPE.DINE_IN)
