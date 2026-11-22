# Phase 2.14 — Mock Contract Conformance

Granular plan for executing section 2.14 from `../implementation-plan.md`.

## Scope

Cross-page mock behaviour that must match `../../docs/api.md` and PRD before API integration starts. Covers the order number format and the session-close authorisation rows missing from the self check.

## Status

DONE — all tasks complete.

## Files

- `src/mocks/handlers/orders.ts` (`nextOrderNumber`)
- `src/mocks/data/orders.ts` (fixtures)
- `src/mocks/selfcheck.ts`

## Tasks

- [x] Change `order_number` to `DI-YYYYMMDD-SSS` / `TA-YYYYMMDD-SSS` (`../../docs/api.md`, last line).
  - `nextOrderNumber` prefixes with the type plus the local business day, then the zero-padded daily sequence.
  - Fixtures in `src/mocks/data/orders.ts` follow the same shape.
  - Assertion at `src/mocks/selfcheck.ts:71` changes from the `TA-` prefix check to the full date pattern.
  - The printed receipt and the board read `order_number` unchanged; only the value shape moves.
- [x] Add self check coverage for table session authorisation.
  - `closeTableSession` succeeds for `CASHIER` and for `OWNER`.
  - `closeTableSession` returns `FORBIDDEN` for `KITCHEN`.
  - A second close returns `NOT_FOUND`.

## Verification

- `VITE_RUN_MOCK_SELFCHECK=true npm run dev` passes with the new assertions.
- Order numbers in the board, the receipt, and the reports fixtures share one format.
- No remaining `TA-001` / `DI-001` literal in `src/mocks/` or `src/features/`.
