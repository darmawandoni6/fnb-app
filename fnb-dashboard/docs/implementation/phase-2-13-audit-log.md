# Phase 2.13 — Audit Log

Granular plan for executing section 2.13 from `../implementation-plan.md`.

## Scope

`/audit-log` for `OWNER`: append-only read of every status change. PRD §7.4, §10.15.

## Status

DONE — all tasks complete.

## Files

- `src/pages/AuditLogPage.tsx`
- `src/mocks/handlers/audit.ts`
- `src/mocks/handlers/shared.ts` (`audit` writer)

## Tasks

- [x] Read-only table over `GET /audit-log` with entity, entity id, action, from and to values, actor, and timestamp.
- [x] `OWNER` only; the handler answers `FORBIDDEN` for other roles.
- [x] Entries are written by handlers on every status change: order, item, payment, table session, settings, stock.
- [x] `actor_id` and `actor_role` are `null` when the scheduler performed the change.
- [x] Append-only in the mock: no update or delete path exists.

## Verification

- A status change appears in the log with the acting user.
- A scheduler-style change has a null actor.
- Other roles cannot open the page.
