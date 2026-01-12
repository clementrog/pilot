# /pilot

Trust infrastructure for AI coding. Ship real software without being an engineer.


## The Problem

AI coding hits a ceiling. You can build an MVP in a weekend, but you can't trust it enough to scale.

- You can't verify if auth logic is secure
- You can't diagnose which change broke things
- Every AI session starts from zero
- No recovery path when things break

**The ceiling isn't skill. It's trust.**

## The Solution

A folder in your repo that acts as shared memory between you and AI tools.

```
/pilot
├── STATE.md      → Where are we now?
├── TASK.md       → Current task (spec + evidence)
├── CONTEXT.md    → Stack and commands
├── ROADMAP.md    → What we're building
├── RULES.md      → AI behavior constraints
├── LOG.md        → What happened
├── POLISH.md     → Deferred improvements
├── /decisions    → Architecture decisions
└── /snapshots    → Backups after commits
```

Any AI reads these files. Claude, Cursor, ChatGPT, Gemini. No vendor lock-in.

## How It Works



### Scope Contracts

Every task defines boundaries:

```yaml
scope:
  must_have:
    - "Add login button"
  forbidden:
    - "Auth logic"
```

Verify the diff only touched expected files. No code reading.

### Evidence-Based Verification

AI provides proof:

```yaml
Evidence:
  diff_files: "src/components/Button.tsx"
  test_output: "✓ 14 tests passed"
  proof_url: "localhost:3000"
```

Binary checks: Did tests pass? Does URL work? Expected files only?

### Red Zones

Critical paths protected:

```yaml
red_zones:
  - "/api/auth/*"
  - "/api/payments/*"
```

Changes require CRITICAL risk + human approval.

### Recovery

Last Known Good (LKG) stored in STATE.md. If broken: `git checkout [lkg]`

## Quick Start

1. Copy `/pilot` folder to your repo
2. Fill `STATE.md` with project name and repo
3. Fill `CONTEXT.md` with your stack
4. Tell orchestrator: "Read /pilot/RULES.md. Say 'status' when ready."
5. Start building

## Commands

| Say | Does |
|-----|------|
| `status` | Current state |
| `health` | Run checks |
| `next` | Advance |
| `stuck` | Get help |
| `undo` | Revert command |
| `restore` | Rollback to LKG |

## Risk Levels

| Risk | Use For | Model |
|------|---------|-------|
| LOW | Typos, styling | Cheap |
| MEDIUM | Components, forms | Standard |
| HIGH | User data, integrations | Advanced |
| CRITICAL | Auth, payments | Best + human gate |

## Philosophy

You don't learn to code. You learn to verify.

## Quick Start

1. [Download the latest release](https://github.com/clementrog/pilot/releases/latest)
2. Extract and copy `pilot/` to your repo
3. Paste `pilot/CLAUDE.md` into your Claude project instructions
4. Give PRD to Claude so it fills `STATE.md` with your project name, `CONTEXT.md` with your stack
5. Say "status"
6. Build


---

MIT License
