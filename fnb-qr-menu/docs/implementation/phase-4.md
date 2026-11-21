# Phase 4 — Tests, Polish, Docs Sync

Granular plan for Phase 4 of `../implementation-plan.md`.

Goal: satisfy PRD §15 with unit tests on the non-trivial logic, finish formatting and accessibility polish, and record the QR Menu adaptations in the root docs.

## Prerequisites

- Phase 3 complete: the app runs against `fnb-server`.
- Docs read: `../docs/PRD.md` §15, `docs/conventions.md` (Test Files).

## Steps

### Step 1 — Add Vitest

Files: `package.json`, `vite.config.ts`

```bash
npm view vitest version
npm install -D vitest
```

- Add `"test": "vitest run"` and `"test:watch": "vitest"` to scripts.
- Configure `test.environment: 'node'` unless a test needs a DOM shim.
- No React Testing Library and no Playwright.

Verify: `npm test` runs with zero tests and passes.

### Step 2 — Test the cart helpers

Files: `src/features/browse/cart.test.ts`

Cases:

- `lineKey` is case-insensitive and trims the note.
- `addToCart` merges equal keys into one line.
- `addToCart` clamps at `MAX_QTY` 50.
- `saveCartLine` returns `added`, `saved`, and `merged` in the right situations.
- `cartLines` drops lines whose menu is missing.
- `qtyOf` sums across differing notes.

Verify: `npm test` passes with every case named after behaviour.

### Step 3 — Test the session store `[REWORK]`

Files: `src/features/session/store.test.ts`

Cases:

- A corrupt stored value yields an empty session, not a throw.
- An unknown `v` yields an empty session.
- A different `qr` clears `cart`, `orders`, and `sessionToken`.
- Storage failure falls back to memory and the session still updates.
- `orders` append preserves order and snapshot.

Verify: `npm test` passes with the storage stub replacing `localStorage`.

### Step 4 — Test the polling predicate `[REWORK]`

Files: `src/features/orders/status.test.ts`

Cases:

- `isFinished` is true for `SELESAI` and `DIBATALKAN`.
- `isFinished` is false for `MENUNGGU` and `DIPROSES`.
- The list poll stops only when every stored order is finished.
- The backoff helper skips exactly one interval after a `429`.

Verify: `npm test` passes.

### Step 5 — Verify formatting and number formats

Files: none (manual)

- Rupiah uses `Intl.NumberFormat('id-ID')` and shows no decimals.
- Times use `Intl.DateTimeFormat`; no date library is installed.
- No `console.log` remains; `console.warn` and `console.error` are allowed.

Verify: `grep -rn "console.log" src` returns nothing.

### Step 6 — Check accessibility and touch targets

Files: screens as needed

- Every interactive element is reachable by keyboard with a visible focus ring.
- Buttons and steppers are at least 44×44 px.
- Images have alt text or are marked decorative.
- The closed banner and errors are announced through shadcn `Alert` or toast roles.
- Contrast holds for text on `bg-canvas` and `bg-accent`.

Verify: tab through every screen on a 375px viewport with no mouse.

### Step 7 — Update `AGENTS.md`

Files: `AGENTS.md`

- Move Status from planned to scaffolded, listing the commands that actually exist.
- Confirm the Commands, Environment, and Architecture sections match the code.
- Note the test command once Vitest exists.

Verify: `AGENTS.md` has no claim that the code contradicts.

### Step 8 — Record the adaptations in the root docs

Files: `../docs/api.md`, `../docs/flow.md`

Add short notes, marked as pending until the frontend behavior ships:

- The customer app identifies the table by `qr_token` only on entry; the session open returns `table_number`, which the menu response does not repeat.
- The customer app has a closed state (`/tutup`) and a browse-only mode.
- The customer app polls the session's order list (`GET /public/orders`) as the real-time fallback; WebSocket (`session:{token}`) is deferred and polling ships first.

Do not change any contract, endpoint, or status value.

Verify: `../docs/api.md` and `../docs/flow.md` still describe the server accurately.

## Phase Checklist

- [ ] `npm test` passes with the three test files.
- [ ] Every test name describes behaviour, not implementation.
- [ ] No date or chart library was added.
- [ ] `grep -rn "console.log" src` returns nothing.
- [ ] Every screen is keyboard reachable with 44×44 px targets.
- [ ] `AGENTS.md` reflects the real commands and status.
- [ ] Root docs record the three adaptations without contract changes.
- [ ] `npm run lint && npm run format:check && npm run build && npm test` pass.

## Exit Criteria

- [ ] PRD §15 coverage: cart rules, session store, status aggregation predicate.
- [ ] Verification order passes in full.
- [ ] Documentation and code agree.

## Gotchas

- Do not add RTL or Playwright; component and E2E testing stay excluded.
- Do not change `../docs/api.md` contracts; only add customer-app notes.
- Keep tests beside the source file per `docs/conventions.md`.
