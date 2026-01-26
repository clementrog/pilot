# Pilot

[![npm](https://img.shields.io/npm/v/create-pilot?style=flat-square&color=cb3837)](https://www.npmjs.com/package/create-pilot)
[![GitHub stars](https://img.shields.io/github/stars/clementrog/pilot?style=flat-square)](https://github.com/clementrog/pilot)
[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

**AI coding agents are powerful but unreliable.** They lose track of what they're doing, edit the wrong files, skip verification, and go off-scope. Pilot fixes this.

Pilot is a lightweight protocol that keeps AI agents focused. It works by creating a shared "contract" between you and the AI — a simple folder of JSON files that tracks what needs to be done, what's been completed, and what to verify.

<p align="center">
  <img src="https://raw.githubusercontent.com/clementrog/pilot/main/workflow.svg" alt="Pilot Workflow" width="100%">
</p>

## Quick start

```bash
npx create-pilot
```

Then open your AI coding tool (Claude Code, Cursor, Windsurf, etc.) and say:

> **"Read BOOT.txt"**

That's it. The AI will pick up the protocol and follow it.

## What problem does this solve?

When you ask an AI to build something complex, things go wrong:

| Problem | How Pilot fixes it |
|---------|-------------------|
| AI forgets what it was doing | State is tracked in `STATE.json` |
| AI edits files it shouldn't | Scope is defined upfront, verified with git |
| AI skips testing | Verification commands are mandatory |
| AI goes in circles | 3-attempt limit, then stops for human help |
| No clear handoff | Structured task contracts between plan and build |

## How it works

Pilot splits work into two roles:

- **Orchestrator** — Plans tasks, defines scope, verifies completion
- **Builder** — Writes code, reports what was done

They communicate through JSON files in a `/pilot` folder:

```
pilot/
├── STATE.json    # Where are we? (phase, attempts, blockers)
├── TASK.json     # What needs to be done? (scope, acceptance criteria)
├── REPORT.json   # What was done? (files changed, test output)
└── ...
```

The key insight: **git is the source of truth**. The orchestrator verifies claims by running `git diff` — not by trusting what the builder says.

## What gets created

Running `npx create-pilot` adds these files to your project:

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

```
IDLE → PLAN → DISPATCH → BUILD → VERIFY → MERGE
                                    ↓
                              [fails 3x]
                                    ↓
                                  HALT
```

1. **PLAN** — Break work into tasks, assess risk
2. **DISPATCH** — Create branch, write task contract
3. **BUILD** — AI writes code within defined scope
4. **VERIFY** — Check git diff, run tests, validate scope
5. **MERGE** — Squash merge to main, clean up

If verification fails 3 times, the system halts and waits for you.

## CLI options

```bash
npx create-pilot              # Scaffold into current directory
npx create-pilot ./spec.md    # Also copy your PRD
npx create-pilot --force      # Overwrite existing pilot/
```

## Works with

- Claude Code
- Cursor
- Windsurf
- Any LLM that can read files

## License

MIT
