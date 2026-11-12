# Documentation Naming Standard

## Scope

Naming standard for all `.md` documentation files in the `fnb-app` monorepo:

- `docs/` (root)
- `fnb-server/docs/`
- `fnb-dashboard/docs/`

## File Naming

Format: `kebab-case.md` — lowercase words separated by hyphens.

```text
✅ tech-stack.md
✅ api-response.md
✅ implementation-plan.md

❌ TECH_STACK.md
❌ TechStack.md
❌ tech stack.md
```

The only exceptions are established upstream names written in uppercase: `README.md`, `AGENTS.md`, `PRD.md`, and `CHANGELOG.md`.

## Location Rules

Place documents according to their scope:

| Location | Scope | Examples |
|---|---|---|
| `docs/` (root) | cross-application | `PRD.md`, `flow.md`, `api.md`, `api-response.md`, `git.md` |
| `fnb-server/docs/` | backend only | `tech-stack.md`, `structure.md`, `rules.md` |
| `fnb-dashboard/docs/` | dashboard only | `tech-stack.md`, `ai-rules.md`, `conventions.md` |

One topic, one application, one file. Do not duplicate content across locations; use relative links such as `../docs/api.md`.

## Content Categories

Use one of these category prefixes or folder structures so the document type is visible from its name:

| Category | Prefix or structure | Use when | Example |
|---|---|---|---|
| Standards and rules | no prefix | permanent rules that always apply | `conventions.md`, `validation.md`, `logging.md` |
| Plans | `plan-` prefix | active work plans not yet executed | `plan-stock.md`, `plan-users-settings.md` |
| Phased implementation | `implementation/` folder + `phase-N.md` | execution breakdown by phase | `implementation/phase-0.md` |
| API specification | `api-` prefix or `api.md` | endpoint contracts | `api.md`, `api-response.md` |
| Reference | no prefix | facts and structure, not rules | `structure.md`, `tech-stack.md`, `flow.md` |

Category rules:

- Remove the `plan-` prefix when a plan is completed and convert it to a regular document, or move it to `implementation/phase-N.md` if the work is phased.
- Phase plans belong in the `implementation/` folder and use `phase-N.md`, with N starting at `0`.
- Do not use dates (`plan-2026-01.md`) or versions (`api-v2.md`) in names; use git history for chronology.
- If an outdated document must be preserved, delete or merge it. Do not add `-old` or `-deprecated` suffixes.

## Canonical Summary

```text
docs/
├── PRD.md                    # established acronym
├── flow.md
├── api.md
├── api-response.md
├── doc-language.md
├── doc-naming.md
└── git.md

fnb-server/docs/
├── AGENTS.md                 # established acronym
├── tech-stack.md
├── structure.md
├── rules.md
├── constants.md
├── validation.md
├── logging.md
├── concurrency.md
└── plan-*.md                 # active plans

fnb-dashboard/docs/
├── AGENTS.md
├── ai-rules.md
├── conventions.md
├── tech-stack.md
├── dashboard-structure.md
├── implementation-plan.md
└── implementation/
    ├── phase-0.md
    └── phase-N.md
```

## Exceptions

No exceptions. `README.md`, `AGENTS.md`, and `PRD.md` are canonical upstream names, not violations.

## File Header

Every document must have this header structure:

- `# Title` — human-readable.
- `## Scope` — one paragraph explaining what the document covers and when it applies.

Documents that reference other sources must include relative paths in Scope (for example, `docs/tech-stack.md` in `fnb-dashboard`).
