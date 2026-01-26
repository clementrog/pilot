# Pilot

[![npm](https://img.shields.io/npm/v/create-pilot?style=flat-square&color=cb3837)](https://www.npmjs.com/package/create-pilot)
[![GitHub stars](https://img.shields.io/github/stars/clementrog/pilot?style=flat-square)](https://github.com/clementrog/pilot)
[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

**AI coding agents made us faster. They also made us sloppy.**

Context in, output out, trust the confident answer. We became copy-paste operators — not thinkers. Every hour went to managing the machine, not directing it.

Pilot is a `/pilot` folder you drop into any repo. It gives AI tools persistent memory, scoped tasks, and evidence-based verification. Multiple roles (planner, builder, reviewer) catch each other's mistakes before they compound.

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

## Why this exists

### For developers

You're burning expensive tokens on the wrong tasks. Using Opus to write CRUD is like hiring a Michelin chef to peel potatoes.

Pilot lets you route work: heavy models think (plan, review), light models type (implement). One clear scope per task. Git diff verifies every claim. No more 47-file diffs from a "quick fix."

### For non-technical builders

AI gave you the ability to build real software — not just spec it, write about it. Actually build it.

But the current workflow leaves no room for taste. You're debugging hallucinations instead of shaping how something should feel.

Pilot automates the tedious parts — verification, scope control, catching drift. So you can focus on direction and craft. Code isn't scarce anymore. Taste is.

## What it optimizes for

| | |
|---|---|
| **Quality** | Hallucinations die in layers, not in production |
| **Cost** | Heavy models think, light models type |
| **Overhead** | No more re-explaining your project every session |
| **Trust** | You verify evidence, not code |

## How it works

Pilot splits work into two roles with strict boundaries:

- **Orchestrator** — Plans tasks, defines scope, verifies completion
- **Builder** — Writes code within scope, reports what was done

They communicate through JSON contracts:

```
pilot/
├── STATE.json    # Where are we? (phase, attempts, blockers)
├── TASK.json     # What to build (scope, acceptance criteria)
├── REPORT.json   # What was done (files changed, test output)
└── ...
```

The key rule: **git is the source of truth**. If a task says "only touch these four files," touching a fifth triggers a stop. Real terminal output as proof, not just "trust me."

## What gets created

```
your-project/
├── pilot/                   # Contract files (JSON)
├── prd/                     # Place your specs here
├── ORCHESTRATOR.md          # Instructions for planning
├── BOOT.txt                 # Quick-start reference
├── .cursorrules             # Builder instructions (Cursor)
└── claude.md                # Builder instructions (Claude Code)
```

## Workflow

1. **PLAN** — Break work into tasks, assess risk
2. **DISPATCH** — Create branch, write task contract
3. **BUILD** — AI writes code within defined scope
4. **VERIFY** — Check git diff, run tests, validate evidence
5. **MERGE** — Squash merge to main, clean up

If verification fails 3 times, the system halts and waits for you.

## CLI options

```bash
npx create-pilot              # Scaffold into current directory
npx create-pilot ./spec.md    # Also copy your PRD
npx create-pilot --force      # Overwrite existing pilot/
```

## Works with

Claude Code · Cursor · Windsurf · Any LLM that can read files

## License

MIT — Free. Open source. Built for how AI coding works today.
