# PILOT v3.1.0

AI orchestration protocol for LLM coding agents.

## Problem

AI agents lose context, edit wrong files, skip verification. The issue isn't capability — it's state management.

## Solution

JSON contracts + role separation + git as truth.

```
Human → Orchestrator (plans) → Builder (executes) → Orchestrator (verifies) → Merge
```

## Quick Start

```bash
# Copy to your project
cp -r pilot-shell/pilot ./pilot
cp pilot-shell/ORCHESTRATOR.md ./
cp pilot-shell/BOOT.txt ./

# Cursor
cp pilot-shell/.cursorrules ./

# Claude Code
cp pilot-shell/claude.md.template ./claude.md
```

## Structure

```
/
├── ORCHESTRATOR.md          # Planning/verify instructions
├── BOOT.txt                 # Quick reference
├── .cursorrules             # Builder (Cursor)
├── claude.md                # Builder (Claude Code)
│
└── pilot/
    ├── STATE.json           # Phase, branch, attempts
    ├── TASK.json            # Work contract
    ├── REPORT.json          # Completion + evidence
    ├── ROADMAP.json         # [optional] Milestones
    ├── REVIEW.json          # [optional] Code review
    ├── DESIGN-CONTRACT.json # [optional] UI specs
    └── skills/              # [optional] Knowledge modules
```

## Core vs Optional

**Core (always):**
- STATE + TASK + REPORT
- Scope enforcement
- Git diff on every verify
- 3-attempt limit

**Optional (add when needed):**
- ROADMAP — multi-milestone planning
- DESIGN-CONTRACT — UI/design specs
- REVIEW — HIGH risk escalation
- Skills — domain knowledge

Start with core. Add modules as complexity grows.

## Contract Ownership

| Role | Writes | Never Touches |
|------|--------|---------------|
| Orchestrator | `/pilot/*` (except REPORT) | Code files |
| Builder | Code (in scope) + REPORT | Other `/pilot/*` |

Reading `.env`/`.key`/`.pem` = protocol violation.

## Evidence

Builder must include in REPORT:
- `git_diff_files` — output of `git diff --name-only main...HEAD`
- `verify.output` — last 20 lines of verify command

Orchestrator verifies claims against git. Git is truth.

## Batch Mode

Bundle 2-5 LOW-risk tasks into one cycle:

```
Single:  branch → build → verify → merge  ×3
Batch:   branch → build [all] → verify → merge
```

Conditions:
- 2-5 tasks, all LOW risk
- Each independently shippable
- No overlapping write scopes
- < 3 hours combined

## Risk Levels

| Risk | Behavior |
|------|----------|
| LOW | Batchable, light verify |
| MED | Acceptance criteria required |
| HIGH | Review before merge |

## Safety

1. Contract ownership — roles only write designated files
2. Forbidden reads — opening secrets = violation
3. Git diff every verify — all risk levels
4. Preflight branch check — before verify
5. Evidence required — git diff + verify output
6. 3 attempts max — then HALT

## Workflow

```
IDLE → PLAN → DISPATCH → BUILD → VERIFY → MERGE → IDLE
                              ↓
                           [REVIEW] (HIGH)
                              ↓
                            HALT (3 failures)
```

## Attempt Rules

Orchestrator increments `attempt` only when rejecting REPORT:
- Scope violation
- Verify failed
- Forbidden read detected

Builder never touches `attempt`.

## Changelog

### v3.1.0
- Contract ownership enforced (violations = attempt increment)
- Forbidden reads are hard violations
- Batch minimum lowered to 2 tasks
- Git diff required on all verifies (not just HIGH)
- Evidence required in REPORT (`git_diff_files`, `verify.output`)
- Explicit attempt increment rules
- Preflight branch check before verify
- Core vs Optional structure clarified
- Renamed "Claude mode" to "Orchestrator/Builder mode"

### v3.0.0
- Initial v3 release
- Batch mode
- Skills system
- Design contract

## License

MIT
