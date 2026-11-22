import type { AuditLogEntry } from '@/types'

import { request } from '../client'

type ServerAuditLogEntry = AuditLogEntry & { entity_id: string; actor_id: string | null }

export const getAuditLog = (filters?: {
  entity?: string
  entity_id?: string
  actor_id?: string
  from?: string
  to?: string
}) => request<ServerAuditLogEntry[]>({ method: 'GET', url: '/audit-log', params: filters })
