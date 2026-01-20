# Pilot v2

Multi-agent orchestration for AI coding. Ship real software without being an engineer.

## The Problem

AI coding tools are powerful but chaotic:
- Context lost between sessions
- No verification that changes are correct
- Scope creep and hallucinated "improvements"
- No audit trail

**You need a system, not just a tool.**

## The Solution

Pilot is a protocol that coordinates multiple AI agents through JSON contracts and Git verification.

```
You (human)
    │
    ▼
┌─────────────┐    TASK.json    ┌─────────────┐
│ Orchestrator │ ─────────────► │   Builder   │
│ (plans)      │                │ (codes)     │
└─────────────┘ ◄───────────── └─────────────┘
    │              REPORT.json
    │
    │ REVIEW.json (HIGH risk only)
    ▼
┌─────────────┐
│  Reviewer   │
│ (audits)    │
└─────────────┘
```

### Agents

| Agent | Role | Tool |
|-------|------|------|
| **Orchestrator** | Plans, dispatches, verifies. Never edits code. | OpenCode (Claude, GPT, etc.) |
| **Builder** | Executes tasks, writes code, runs tests. | Cursor |
| **Reviewer** | Audits HIGH-risk changes before merge. | Gemini, ChatGPT, or any LLM |

### Contracts

All communication happens through structured JSON files:

```
/pilot
├── TASK.json      → Work package (orchestrator writes, builder reads)
├── REPORT.json    → Execution results (builder writes, orchestrator verifies)
├── ROADMAP.json   → Milestone tracking
└── REVIEW.json    → Escalation reviews
```

### Trust Model

1. **Scope lock** — Builder can only touch files explicitly allowed
2. **Git is truth** — Claims verified against `git diff`, not self-reporting
3. **3-strike rule** — 3 failed attempts = HALT, human intervention required
4. **Risk gates** — HIGH-risk changes require external review before merge

## Quick Start

### 1. Download

```bash
# Clone or download the latest release
git clone https://github.com/clementrog/pilot.git
cp -r pilot/pilot your-project/pilot
cp pilot/ORCHESTRATOR.md your-project/
cp pilot/BOOT.txt your-project/
cp pilot/STATE.json your-project/
cp pilot/.cursorrules your-project/
mkdir -p your-project/prd
```

### 2. Add Your PRD

Create `prd/your-feature.md` with what you want to build.

### 3. Start Orchestrator

Open your project in OpenCode (or any terminal-enabled AI tool) and say:

```
Read BOOT.txt
```

The orchestrator will:
1. Read your PRD
2. Create milestones in ROADMAP.json
3. Break work into packages
4. Dispatch to builder

### 4. Execute in Cursor

When orchestrator says "Task dispatched", open Cursor and run your builder command. The builder reads `TASK.json` and executes.

### 5. Verify and Merge

When builder is done, tell orchestrator "done". It verifies against Git and merges.

## Work Packages

Tasks are batched by risk level to reduce handoffs:

| Risk | Batch Size | Examples |
|------|------------|----------|
| LOW | 3-5 subtasks | UI, tests, docs |
| MED | 2-3 subtasks | API endpoints, state |
| HIGH | 1 task only | Auth, payments, infra |

A single work package might include:
```json
{
  "goal": "Complete user signup flow",
  "subtasks": [
    "Create SignupForm component",
    "Add email validation",
    "Connect to auth API",
    "Write tests"
  ]
}
```

Builder completes all subtasks, reports once. Fewer handoffs = faster shipping.

## Verification Modes

### Light Verify (LOW risk)
- Run test/lint commands
- Quick scope check
- Trust REPORT.json

### Full Verify (MED/HIGH risk)
- Branch validation
- Ghost file detection (REPORT vs git status)
- Acceptance criteria confirmation
- Scope enforcement

## File Reference

| File | Purpose |
|------|---------|
| `ORCHESTRATOR.md` | Full orchestrator instructions |
| `BOOT.txt` | Quick-start bootstrap |
| `.cursorrules` | Builder agent instructions |
| `STATE.json` | Current workflow state |
| `pilot/TASK.json` | Active work package |
| `pilot/REPORT.json` | Builder's execution report |
| `pilot/ROADMAP.json` | Milestone tracking |
| `pilot/REVIEW.json` | Review requests/responses |
| `prd/*.md` | Product requirement documents |

## Workflow States

```
IDLE → PLAN → DISPATCH → BUILD → VERIFY → [REVIEW] → MERGE → IDLE
                                              │
                                            HALT (3 failures)
```

## Model Agnostic

Pilot works with any LLM that can read/write files:

- **Orchestrator**: Claude (OpenCode), GPT-4, or any model with terminal access
- **Builder**: Cursor Agent, Windsurf, Aider
- **Reviewer**: Gemini, ChatGPT, Claude, or any model with file access

No vendor lock-in. Switch models anytime.

## Upgrading from v1

v2 is a complete rewrite. Key changes:

| v1 | v2 |
|----|-----|
| Markdown contracts | JSON contracts |
| Single agent | 3-agent model |
| Manual verification | Git-verified trust |
| Task-by-task | Work packages with subtasks |

To upgrade: replace your `/pilot` folder with v2 files. Old markdown files are not compatible.

---

MIT License
