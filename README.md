# Pilot

[![npm](https://img.shields.io/npm/v/create-pilot?style=flat-square&color=cb3837)](https://www.npmjs.com/package/create-pilot)
[![GitHub stars](https://img.shields.io/github/stars/clementrog/pilot?style=flat-square)](https://github.com/clementrog/pilot)
[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

A `/pilot` folder you drop into any repo. JSON contracts that give AI agents persistent memory, scoped tasks, and verified commits.

```
Human → Plan → Dispatch → Build → Verify → Merge
         ↑                           ↓
         └─────── [retry x3] ────────┘
```

## Quick start

```bash
npx create-pilot
```

Then open your AI tool (Claude Code, Cursor, Windsurf) and say: **"Read BOOT.txt"**

## What it does

- **Persistent state** — AI remembers where you left off. No re-explaining your project every session.
- **Scoped tasks** — Task says "only touch these 4 files"? Touching a 5th triggers a stop.
- **Evidence-based verification** — Git diff + terminal output as proof. Not "trust me."
- **Role separation** — Planner, builder, reviewer catch each other's mistakes before they compound.
- **Secret protection** — Reading `.env`, `.key`, `.pem` = immediate violation.

## Why use this

### If you're a developer

The bottleneck isn't "not enough tokens." It's vague tasks turning into 47-file diffs and hours of debug.

Pilot enforces structure:
- **Token efficiency** — Route planning to expensive models, implementation to fast/cheap ones
- **Scope control** — Git diff required on every verify, not just high-risk tasks
- **Batch mode** — Group 2-5 low-risk tasks into one cycle
- **3-attempt limit** — Fails three times? Halts for human review instead of looping forever

### If you're a non-technical builder

AI let you build real software. But the current workflow is: context in, output out, trust the confident answer, debug for hours.

Pilot automates the verification so you can focus on direction:
- **Reliability by default** — Errors caught in layers, not in production
- **Clear boundaries** — You define what AI can and can't touch
- **Evidence you can check** — Verify terminal output, not code

## How it works

Two roles, strict boundaries:

| Role | Writes | Cannot touch |
|------|--------|--------------|
| **Orchestrator** | `STATE`, `TASK`, `ROADMAP`, `REVIEW` | Code files |
| **Builder** | Code (in scope) + `REPORT` | Other `/pilot/*` files |

They communicate through JSON:

```
pilot/
├── STATE.json    # Current phase, branch, attempts
├── TASK.json     # Scope, acceptance criteria, verify commands
├── REPORT.json   # Files changed, terminal output, blockers
└── ...
```

Git is the source of truth. Claims in `REPORT.json` are verified against actual `git diff`.

## What gets created

```
your-project/
├── pilot/                   # JSON contracts
├── prd/                     # Your specs go here
├── ORCHESTRATOR.md          # Planner instructions
├── BOOT.txt                 # Quick reference
├── .cursorrules             # Builder instructions (Cursor)
└── claude.md                # Builder instructions (Claude Code)
```

## Workflow

1. **PLAN** — Decompose work, assess risk level
2. **DISPATCH** — Create branch, write task contract with scope
3. **BUILD** — AI implements within defined boundaries
4. **VERIFY** — Git diff, run tests, check evidence
5. **MERGE** — Squash to main, clean up

Fails 3 times → **HALT**. Waits for you.

## CLI

```bash
npx create-pilot              # Scaffold into current directory
npx create-pilot ./spec.md    # Include your PRD
npx create-pilot --force      # Overwrite existing
```

## Works with

Claude Code · Cursor · Windsurf · Any LLM that reads files

## License

MIT
