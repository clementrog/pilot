# Claude Code — PILOT v3

**Auto-start:** Read `/pilot/STATE.json` immediately and act on current phase.

---

## CONTRACT OWNERSHIP

| Mode | Can Write | Cannot Write |
|------|-----------|--------------|
| **Orchestrator mode** | `STATE.json`, `TASK.json`, `ROADMAP.json`, `REVIEW.json`, `DESIGN-CONTRACT.json` | Code files |
| **Builder mode** | Code (in scope) + `REPORT.json` | Other `/pilot/*` files |

**Violations count toward 3-attempt limit.**

**Read restriction:** Never open `.env*`, `*.key`, `*.pem` — even "for context" = violation.

---

## ROLE DETECTION

| Signal | Mode |
|--------|------|
| `phase: BUILD` in STATE | **Builder** — execute TASK.json |
| Any other phase | **Orchestrator** — manage contracts |
| User says "build", "implement" | Builder override |
| User says "plan", "review", "verify" | Orchestrator override |

---

## CORE vs OPTIONAL

**Core (always):** STATE + TASK + REPORT + scope + verify + 3 attempts

**Optional:** ROADMAP (planning), DESIGN-CONTRACT (UI), REVIEW (escalation), skills

Start simple. Add modules as needed.

---

## ORCHESTRATOR MODE

| Phase | Action |
|-------|--------|
| IDLE | Check ROADMAP or ask user for task |
| PLAN | List tasks, check batch opportunity (2+ LOW, independent, no conflicts) |
| DISPATCH | Write TASK.json, create branch |
| VERIFY | **Preflight:** confirm branch matches STATE. Git diff, verify commands |
| REVIEW | Write REVIEW.json, wait for verdict |
| MERGE | Squash merge to main, cleanup |
| HALT | Explain failures, wait for human |

**Attempt rule:** Only increment `attempt` when rejecting REPORT.

---

## BUILDER MODE

1. Read TASK.json
2. Check `mode`:
   - `"batch"` → execute all in `batch[]` order, report once
   - Otherwise → execute `subtasks[]` (use `implementation{}` if provided)
3. Never touch files in `scope.forbidden`
4. Never read files in `scope.read_forbidden`
5. Run verify commands
6. Write REPORT.json with:
   - `git_diff_files` (run `git diff --name-only main...HEAD`)
   - `verify.output` (last 20 lines)
7. Say "done"

**Batch partial:** If blocked mid-batch, set `status: "PARTIAL"` and list completed tasks.

---

## BATCH MODE

**Conditions (all must be true):**
- 2-5 pending tasks
- All LOW risk
- All independently shippable
- No overlapping write scopes
- < 3 hours combined

**Branch:** `batch/[milestone]-[desc]`

**Report once** after all tasks complete.

---

## RULES

1. Contract ownership — only write your designated files
2. Forbidden reads = violation
3. Git diff every verify (orchestrator)
4. Include evidence in REPORT (builder)
5. Preflight branch check before verify
6. 3 attempts → HALT
