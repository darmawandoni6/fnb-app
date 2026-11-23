# Phase 1 — Mock Layer

Granular plan for executing phase 1 from `../implementation-plan.md`.

## Scope

In-memory mock backend with the same signatures and return types as the HTTP module, so phase 2 builds screens without a running server and phase 3 only flips `src/api/index.ts`.

## Status

DONE — mock layer shipped.

## Files

- `src/mocks/index.ts`
- `src/mocks/data/menus.ts`, `src/mocks/data/orders.ts`, `src/mocks/data/sessions.ts`
- `src/mocks/handlers/index.ts`, `session.ts`, `publicMenu.ts`, `publicOrders.ts`
- `src/lib/apiError.ts`

## Tasks

- [x] Seed the in-memory store once and expose the same five functions as the HTTP module.
- [x] Menu fixtures: "Kopi Senja", `service_rate` 5, `tax_rate` 10, open and closed variants, integer rupiah, two items with `image_url: null`.
- [x] Order fixtures covering `MENUNGGU`, `DIPROSES`, `SELESAI`, `DIBATALKAN`; item statuses `PENDING` … `CANCELLED`; both payment statuses.
- [x] Scenario table bound to the issued `session_token`, never read from `qr_token` inside order handlers:

  | `qr_token`     | Behaviour                                           |
  | -------------- | --------------------------------------------------- |
  | `demo-meja`    | open store                                          |
  | `demo-tutup`   | `is_open: false`, order creation `409 STORE_CLOSED` |
  | `demo-habis`   | order creation `409 STOCK_NOT_ENOUGH`               |
  | `demo-invalid` | session open `404 NOT_FOUND`                        |
  | unknown        | session open `404 NOT_FOUND`                        |

- [x] Unknown session token returns `401 UNAUTHORIZED` on menu, list, create, and cancel.
- [x] Create validates empty `customer_name`, empty items, `qty` 1–50, unknown menu; prepends newest first.
- [x] Cancel returns `404 NOT_FOUND` for a foreign id and `409 INVALID_TRANSITION` unless `MENUNGGU` + `BELUM`; success flips the order, items, reason, and timestamp.
- [x] Every handler sleeps 200–500 ms so loading states are visible.
- [x] Errors use backend codes only: `NOT_FOUND`, `UNAUTHORIZED`, `STORE_CLOSED`, `INVALID_TRANSITION`, `VALIDATION_ERROR`, `STOCK_NOT_ENOUGH`.
- [x] `VITE_USE_MOCKS=true npm run build` fails.

## Verification

- Open session → menu → create → list → cancel works in memory.
- Each `demo-*` token behaves per the table.
- Signatures match the public API exactly; `git diff --stat` shows no HTTP module change.

## Notes

- Mock state resets on reload; that is acceptable for slicing.
- Do not add an endpoint `fnb-server` does not expose.
- Keep money in integer rupiah and compute fixtures by hand.
- Superseded in phase 2.8: `getPublicOrders` must return `paymentUrl: null`, and order numbers must use `DI-YYYYMMDD-SSS`.
