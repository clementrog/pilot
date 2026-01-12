# CONTEXT

```yaml
project:
  name: ""
  type: saas
  phase: alpha

repo: ""

ai:
  provider: anthropic
```

---

## Stack

```yaml
framework: "next@14 (app-router)"
lang: "typescript@5 (strict)"
runtime: "node@20"
pkg: "pnpm@9"
styling: "tailwind@3"
ui: "shadcn/ui"
db: "prisma@5 + postgresql"
auth: "nextauth"
host: "vercel"
```

---

## Environment

```yaml
required:
  - "DATABASE_URL"
  - "NEXTAUTH_SECRET"
  - "NEXTAUTH_URL"

optional: []
```

---

## Directories

```yaml
/app: "Pages and API routes"
/components: "React components"
/components/ui: "shadcn (don't edit)"
/lib: "Utilities"
/prisma: "Schema and migrations"
/pilot: "This system"
```

---

## Protected Files

```yaml
protected:
  - "/lib/db.ts"
  - "/prisma/schema.prisma"
  - "/.env*"
  - "/middleware.ts"
```

---

## Commands

```yaml
dev: "pnpm dev"
build: "pnpm build"
test: "pnpm test"
typecheck: "pnpm tsc --noEmit"
install: "pnpm install"
clean: "rm -rf node_modules .next && pnpm install"

db_generate: "pnpm prisma generate"
db_migrate: "pnpm prisma migrate dev --name "
db_studio: "pnpm prisma studio"

git_status: "git status"
git_diff: "git diff --name-only"
git_checkpoint: "git add . && git commit -m 'checkpoint'"
```

---

## Health Check

```yaml
quick: "pnpm tsc --noEmit && pnpm test"
full: "pnpm tsc --noEmit && pnpm test && pnpm build"
```

---

## Recovery

```yaml
steps:
  - "git stash"
  - "git checkout [LKG from STATE.md]"
  - "rm -rf node_modules .next && pnpm install"
  - "pnpm dev"
```

---

## Decisions

```yaml
active: []
```

---

## Debt

```yaml
items: []
```
