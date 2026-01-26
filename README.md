# Pilot

Pilot is an orchestration protocol that helps AI coding agents stay on track. It uses JSON contracts, role separation, and git verification to prevent the usual failure modes: lost context, scope creep, wrong file edits, skipped tests.

```
Human → Orchestrator (plans) → Builder (executes) → Orchestrator (verifies) → Merge
```

## Get started

```bash
npx create-pilot
```

Or with a PRD:

```bash
npx create-pilot ./spec.md
```

Then open your LLM (Claude Code, Cursor, etc.) and say: **"Read BOOT.txt"**

## What it creates

```
your-project/
├── pilot/
│   ├── STATE.json           # Current phase, branch, attempts
│   ├── TASK.json            # Work contract for builder
│   ├── REPORT.json          # Completion claim + evidence
│   ├── ROADMAP.json         # Milestone planning
│   ├── REVIEW.json          # Code review
│   └── DESIGN-CONTRACT.json # UI specs
├── prd/
├── ORCHESTRATOR.md          # Planning instructions
├── BOOT.txt                 # Quick reference
├── .cursorrules             # Builder instructions (Cursor)
└── claude.md                # Builder instructions (Claude Code)
```

## How it works

**Two roles, strict boundaries:**

| Role | Writes | Never touches |
|------|--------|---------------|
| Orchestrator | `/pilot/*` (except REPORT) | Code files |
| Builder | Code (in scope) + REPORT | Other `/pilot/*` |

**Git as truth:** Every verify runs `git diff --name-only` to check scope. Claims in REPORT.json are verified against actual changes.

**3-attempt limit:** After 3 failed verifications, the system halts for human intervention.

## Workflow

```
IDLE → PLAN → DISPATCH → BUILD → VERIFY → MERGE
                              ↓
                           [REVIEW] (HIGH risk)
                              ↓
                            HALT (3 failures)
```

## Risk levels

| Risk | Behavior |
|------|----------|
| LOW | Batchable (2-5 tasks), light verify |
| MED | Acceptance criteria required |
| HIGH | Code review before merge |

## CLI options

```bash
npx create-pilot              # scaffold only
npx create-pilot ./prd.md     # scaffold + copy PRD to prd/input.md
npx create-pilot -            # read PRD from stdin
npx create-pilot --force      # overwrite existing pilot/
```

## Documentation

- `BOOT.txt` — Quick reference for starting sessions
- `ORCHESTRATOR.md` — Full protocol for the planning role
- `.cursorrules` / `claude.md` — Instructions for the builder role

## License

MIT
