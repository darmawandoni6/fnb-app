# Phase 2.11 — Settings

Granular plan for executing section 2.11 from `../implementation-plan.md`.

## Scope

`/settings` for `OWNER`: the eight outlet settings from PRD §10.16, consumed by the board timers and the kitchen warning.

## Status

DONE — all tasks complete.

## Files

- `src/pages/SettingsPage.tsx`
- `src/features/settings/settingsSchema.ts`
- `src/mocks/handlers/settings.ts`

## Tasks

- [x] All eight fields editable: `cafe_name`, `service_rate`, `tax_rate`, `is_open`, `cash_timeout_minutes`, `delivered_auto_complete_minutes`, `ready_auto_deliver_minutes`, `ready_auto_deliver_warning_minutes`.
- [x] `ready_auto_deliver_warning_minutes` must be lower than `ready_auto_deliver_minutes`; otherwise `400 VALIDATION_ERROR` (`../../docs/api.md`, Internal — users, settings).
  - Enforce across the pair in `updateSettings`, reading the stored value for whichever field the body omits, so a partial patch cannot produce an invalid pair.
  - Mirror the rule in `settingsSchema` with a `refine` across both fields; the current check only rejects values below 1.
  - Timers stay integers of at least 1 minute.

## Verification

- Setting the warning equal to or above the auto-deliver value is rejected client-side and by the mock.
- Patching only the auto-deliver below the stored warning is also rejected.
- Rate changes apply to new orders only; existing orders keep their snapshots (BR-12).
