# Documentation Language Standard

## Scope

Language standard for all `.md` documentation files in the `fnb-app` monorepo (`docs/`, `fnb-server/docs/`, and `fnb-dashboard/docs/`). Complements `doc-naming.md`.

## Rules

1. All documentation must be written in English.
2. New documents must be written in English from the start.
3. Existing documents that still contain Indonesian should be translated when the document is touched (edited or reviewed), rather than through a forced mass migration.
4. Domain words and terms from the PRD must retain their original values because they are backend literal values, not translations:
   - Order statuses: `MENUNGGU`, `DIPROSES`, `SIAP`, `DIANTAR`, `SELESAI`, `DIBATALKAN`.
   - Item statuses: `PENDING`, `COOKING`, `READY`, `DELIVERED`, `CANCELLED`.
   - Payment values: `BELUM`, `LUNAS`, `CASH`, `NON_CASH`.
   - Roles: `OWNER`, `CASHIER`, `KITCHEN`.
5. File names, API field names (`snake_case`), code identifiers, paths, and commands remain unchanged.
6. Indonesian domain terms used as explanations (for example, "papan dapur") must be written in English (kitchen board), not mixed into the document.
7. Application UI copy is written in Indonesian (product decision; see `fnb-dashboard/docs/tech-stack.md`). This rule applies to documentation only, not application content.

## Translation Checklist

When translating an existing document:

- Do not change technical meaning; change language only.
- Do not change file names, paths, commands, or code examples.
- Do not translate status or role values (Rule 4).
- Update cross-document references if a translated sentence refers to a specific section.

## Reference

- File naming standard: `docs/doc-naming.md`.
