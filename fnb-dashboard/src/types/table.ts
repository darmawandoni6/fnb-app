export type Table = {
  id: string
  table_number: string
  qr_token: string
  is_active: boolean
}

export type TableSessionStatus = 'OPEN' | 'CLOSED'

export type TableSession = {
  id: string
  table_id: string
  session_token: string
  status: TableSessionStatus
  started_at: string
  ended_at: string | null
  closed_by: string | null
}
