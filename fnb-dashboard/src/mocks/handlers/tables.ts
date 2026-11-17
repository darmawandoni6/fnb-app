import { API_ERROR_CODE, USER_ROLE } from '@/constants'
import { db } from '@/mocks/db'
import type { Table } from '@/types'

import { delay, fail, findOrThrow, requireRole } from './shared'

export const getTables = async (): Promise<Table[]> => {
  await delay()
  return [...db.tables]
    .sort((a, b) => {
      const left = Number(a.number)
      const right = Number(b.number)
      if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right
      return a.number.localeCompare(b.number, 'id', { numeric: true })
    })
    .map((table) => ({ ...table }))
}

export const createTable = async ({ number }: { number: string }): Promise<Table> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  const trimmed = number.trim()
  if (!trimmed) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nomor meja wajib diisi')
  if (db.tables.some((table) => table.number.trim() === trimmed)) {
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nomor meja sudah ada')
  }
  const table: Table = {
    id: `table-${Date.now()}`,
    number: trimmed,
    qr_token: `qr-${crypto.randomUUID()}`,
    is_active: true,
  }
  db.tables.push(table)
  return { ...table }
}

export const updateTable = async (
  id: string,
  body: { number?: string; is_active?: boolean },
): Promise<Table> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  const table = findOrThrow(
    db.tables.find((candidate) => candidate.id === id),
    API_ERROR_CODE.NOT_FOUND,
    'Meja tidak ditemukan',
  )
  const targetTable = table!
  if (body.number !== undefined) {
    const trimmed = body.number.trim()
    if (!trimmed) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nomor meja wajib diisi')
    if (db.tables.some((candidate) => candidate.id !== id && candidate.number.trim() === trimmed))
      fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nomor meja sudah ada')
    targetTable.number = trimmed
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
