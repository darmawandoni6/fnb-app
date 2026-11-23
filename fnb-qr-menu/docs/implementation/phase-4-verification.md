# Phase 4 — Verification

Granular plan for executing phase 4 from `../implementation-plan.md`.

## Scope

Satisfy PRD §15 with unit tests on non-trivial logic, verify every screen, close accessibility and formatting gaps, and sync documentation. No component or E2E framework.

## Status

PARTIAL — Vitest, scripts, and the first three test files exist; the remaining checks below are open.

## Depends on

- Phase 3 complete.
- PRD §15; `docs/conventions.md` (test files).

## Files

- `vite.config.ts`, `package.json`
- `src/features/browse/cart.test.ts`, `src/features/session/store.test.ts`, `src/features/orders/status.test.ts`
- `src/api/socket.ts` helpers for the new tests
- `AGENTS.md`, `docs/tech-stack.md`, `docs/ai-rules.md`, `../../docs/api.md`, `../../docs/flow.md`

## Tasks

- [x] Vitest installed; `npm test` runs `vitest run`.
- [x] Cart tests: key normalization, merge, clamp at 50, `saveCartLine` outcomes, hidden lines, `qtyOf`.
- [x] Session tests: corrupt storage, unknown version, new `qr` reset, cross-tab sync.
- [x] Status tests: empty history, terminal predicate, unfinished count.
- [ ] Status tests: union merge appends unknown list entries and keeps stored snapshots.
- [ ] Socket tests: URL builder, topic string, backoff sequence, cleanup stops reconnect.
- [ ] Polling test: `429` doubles the interval exactly once and keeps snapshots.
- [ ] Manual per-screen pass on a 375 px viewport: home, detail, cart, checkout, status, closed, invalid.
- [ ] Keyboard pass: every control reachable with a visible focus ring; touch targets at least 44×44 px.
- [ ] No `console.log` under `src/`; `console.warn` and `console.error` allowed.
- [ ] Rupiah uses `Intl.NumberFormat('id-ID')`, no decimals; dates use `Intl` with no date library.
- [ ] `AGENTS.md` status and commands match the code, including phase 2.8 and phase 5.
- [ ] Root docs record the customer adaptations without changing any contract: session-token identity, `/tutup` and browse-only, polling plus the `session:{token}` socket.
- [ ] `docs/tech-stack.md`, `docs/ai-rules.md`, `docs/qr-menu-structure.md` reflect the final behaviour.

## Verification

- `npm test` passes with every behaviour named as a sentence.
- `npm run lint && npm run format:check && npm run build && npm test` pass.
- No RTL, Playwright, Storybook, Redux, Zustand, chart library, or date library is installed.
- `git diff --stat` for the docs sync touches docs only.

## Notes

- Keep tests beside the source file.
- Do not add a test framework for components; the slice stays unit-level.
