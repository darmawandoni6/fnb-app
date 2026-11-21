import { USER_ROLE } from '@/constants'
import { db } from '@/mocks/db'
import type { AuditLogEntry } from '@/types'

import { delay, requireRole } from './shared'

export type AuditLogFilters = {
  entity?: string
  entity_id?: string
  actor_id?: string
  from?: string
  to?: string
}

/** PRD §7.4 / api.md: OWNER reads the append-only audit trail. */
export const getAuditLog = async (filters?: AuditLogFilters): Promise<AuditLogEntry[]> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  return db.auditLog
    .filter(
      (entry) =>
        (!filters?.entity || entry.entity === filters.entity) &&
        (!filters?.entity_id || entry.entity_id === filters.entity_id) &&
        (!filters?.actor_id || entry.actor_id === filters.actor_id) &&
        (!filters?.from || entry.created_at.slice(0, 10) >= filters.from) &&
        (!filters?.to || entry.created_at.slice(0, 10) <= filters.to),
    )
    .map((entry) => ({ ...entry }))
}
