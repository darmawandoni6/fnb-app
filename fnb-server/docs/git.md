# Git Commit and Push Standard

Use this document before every commit and push.

## Commit Rules

1. Make one logical change per commit.
2. Use Conventional Commit format:

```text
type(scope): summary
```

3. Allowed types:

- `feat` — new behavior
- `fix` — bug fix
- `docs` — documentation only
- `refactor` — behavior-preserving code change
- `test` — tests only
- `chore` — maintenance
- `build` — build or dependency changes
- `ci` — CI changes

4. Write summary in imperative mood, lowercase, without a trailing period.
5. Keep summary at 72 characters or fewer.
6. Explain why in commit body when change is non-obvious.
7. Never commit `.env`, credentials, passwords, tokens, or generated binaries under `bin/`.
8. Review staged files before committing:

```bash
git status
git diff --cached
```

## Commit Checklist

```text
[ ] One logical change
[ ] Message uses type(scope): summary
[ ] Summary is imperative, lowercase, and <= 72 characters
[ ] No .env, credentials, tokens, or bin/ files staged
[ ] Tests pass
[ ] Documentation updated when behavior or structure changed
```

Recommended commit check:

```bash
go test ./...
go build ./...
```

## Push Rules

1. Commit only after reviewing staged changes.
2. Run tests and build before pushing.
3. Sync branch before pushing when other contributors may have pushed:

```bash
git pull --rebase origin <branch>
```

4. Resolve conflicts, then rerun tests.
5. Never force-push shared branches.
6. Push explicitly to the intended remote and branch:

```bash
git push origin <branch>
```

## Push Checklist

```text
[ ] Correct branch
[ ] Correct remote
[ ] Working tree reviewed
[ ] go test ./... passes
[ ] go build ./... passes
[ ] Branch synchronized when needed
[ ] No secrets staged or committed
```

## Examples

```text
feat(health): add API health endpoint
fix(database): use configured PostgreSQL port
docs(git): document commit rules
refactor(config): move environment constants
```
