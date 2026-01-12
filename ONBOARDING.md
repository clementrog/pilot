# ONBOARDING

## Quick Setup

### 1. Fill STATE.md

```yaml
project: "your-project-name"
repo: "git@github.com:you/repo.git"
```

### 2. Fill CONTEXT.md

Update the stack section to match your project.

### 3. Fill ROADMAP.md

Add your vision and first milestone.

### 4. Get Current Git Info

Run these commands and update STATE.md:

```bash
git rev-parse HEAD          # → git.head
git rev-parse HEAD          # → git.lkg (same as head initially)
```

### 5. Run Health Check

```bash
pnpm tsc --noEmit && pnpm test
```

If passes, set `health.status: PASS` in STATE.md.

### 6. Start

Tell your orchestrator (Claude/ChatGPT):

> Read /pilot/STATE.md and /pilot/RULES.md. You are the orchestrator. Say 'status' when ready.

---

## Delete This File

Once setup is complete, delete ONBOARDING.md — you won't need it again.
