# Pilot Engine

Pilot is an autonomous build loop engine.

Engine lives in the npm package (runner + CLI + templates). Each repo keeps a small `pilot/` runtime workspace (mostly user data).

## Nested workspace (recommended)

For a cleaner repo root, use `--workspace .pilot`:

```bash
pnpm exec pilot init --workspace .pilot
pnpm exec pilot run --workspace .pilot
```

This works inside existing git repos; all operational files (STATE, TASK, history, etc.) live under `.pilot/`.

## Quick start

```bash
pnpm add -D pilot-engine

# Create ./pilot workspace
pnpm exec pilot init

# Optional: sanity check
pnpm exec pilot doctor

# Run the loop
pnpm exec pilot run

# Or run one cycle
pnpm exec pilot run --once

# Upgrade managed runtime files + migrate STATE schema
pnpm exec pilot upgrade
```

## Workspace ownership

Never overwritten by upgrades:
- `pilot/ROADMAP.json`
- `pilot/TASK.json`
- `pilot/REPORT.json`
- `pilot/BLOCKED.json`

Runner-owned (safe to ignore):
- `pilot/CONTEXT.json`, `pilot/RECENT.json`, `pilot/run.log*`, `pilot/history/`, `pilot/.tmp/`, `pilot/.backup/`
