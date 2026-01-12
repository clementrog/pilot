# RULES

## Roles
```yaml
orchestrator:
  tools: ["Claude", "ChatGPT"]
  owns: ["STATE.md", "TASK.md spec", "TASK.md verification", "LOG.md"]
  does: ["Write specs", "Validate evidence", "Manage workflow"]

builder:
  tools: ["Cursor", "Claude Code", "Codex"]
  owns: ["TASK.md plan", "TASK.md implementation", "TASK.md evidence", "Code"]
  does: ["Implement code", "Provide evidence"]

human:
  owns: ["ROADMAP.md", "Final approval", "Commits"]
  does: ["Verify evidence", "Approve commits", "Run commands"]
```

## Commands
```yaml
init:
  reads: [STATE.md, CONTEXT.md, ROADMAP.md, RULES.md]
  does: "Full context load, report status"
  when: "Start of session only"

status:
  reads: [STATE.md, TASK.md (header only)]
  does: "Quick report"
  cost: "Minimal"

next:
  reads: [TASK.md]
  does: "Advance workflow"
  
pause:
  writes: [STATE.md, LOG.md]
  does: "Save checkpoint, safe to exit"

stuck:
  reads: [STATE.md, TASK.md, LOG.md]
  does: "Diagnose, suggest action"

health:
  reads: [CONTEXT.md (commands)]
  does: "Run checks, update STATE.md"

restore:
  reads: [STATE.md (lkg)]
  does: "Give git checkout command"
```

## Risk Levels
```yaml
LOW:
  examples: ["Fix typo", "Update copy", "Adjust styling"]
  model: "Cheap (Haiku, GPT-4o-mini)"
  review: "Evidence only"

MEDIUM:
  examples: ["New component", "Form handling", "API call"]
  model: "Standard (Sonnet, GPT-4o)"
  review: "Evidence + human check"

HIGH:
  examples: ["User data", "Complex state", "Integrations"]
  model: "Advanced (Sonnet Extended, o1)"
  review: "Evidence + human + testing"

CRITICAL:
  examples: ["Auth", "Payments", "Database schema", "Security"]
  model: "Best (Opus)"
  review: "Human gate before AND after"
```

## Red Zones
```yaml
paths:
  - "/api/auth/*"
  - "/api/payments/*"
  - "/lib/auth*"
  - "/lib/db*"
  - "/prisma/*"
  - "*.env*"
  - "/middleware.*"

operations:
  - "Auth/session logic"
  - "Payment processing"
  - "Database schema changes"
  - "New dependencies"
  - "Environment variables"

rule: "Red zone changes require CRITICAL risk + human approval BEFORE implementation"
```

## Builder Instructions

### Before Coding

1. Read TASK.md spec
2. Read RULES.md (this file)
3. Check scope.must_have — implement ONLY these
4. Check scope.forbidden and red_zones — do NOT touch

### While Coding
```yaml
allowed:
  - "Files in scope"
  - "Operations in allowed_operations"
  - "Bug fixes in touched files"

forbidden:
  - "Files in scope.forbidden"
  - "Red zone paths"
  - "New dependencies without approval"
  - "Architectural changes without flagging"
```

### After Coding

Update TASK.md:

1. Implementation section: status, changes, deviations
2. Evidence section: diff_files, test_output, build_output, proof_url, acceptance

### Evidence Rules
```yaml
must_be:
  - "Real terminal output"
  - "Complete (all fields)"
  - "Verifiable (human can reproduce)"

never:
  - "AI-generated fake output"
  - "Placeholder URLs"
  - "Skipped fields"
```

### Done Checklist
```
□ Code matches scope.must_have
□ No forbidden files touched
□ No red zones touched
□ TASK.md Implementation filled
□ TASK.md Evidence filled with real output
□ All acceptance checked
```

## Orchestrator Instructions

### On Session Start

1. Read STATE.md
2. If task exists, read TASK.md
3. Report: Project, Task, Step, Health, Next

### Workflow
```
idle → building → verifying → done → idle
```

### Evidence Validation
```yaml
approve_if:
  - "diff_files only has expected files"
  - "No red zones in diff"
  - "test_output looks real"
  - "build_output shows success"
  - "proof_url works"
  - "All acceptance checked"

reject_if:
  - "Evidence incomplete"
  - "Unexpected files in diff"
  - "Red zone touched without approval"
  - "Output looks AI-generated"
```

## Recovery
```yaml
soft_reset:
  when: "Know which file broke"
  cmd: "git checkout [file]"

hard_reset:
  when: "Unknown cause"
  cmd: "git checkout [lkg]"

nuclear:
  when: "Everything broken"
  cmds:
    - "git stash"
    - "git checkout [lkg]"
    - "rm -rf node_modules .next"
    - "pnpm install"
```

## Commits
```yaml
format: "type: description"
types: ["feat", "fix", "refactor", "style", "docs", "test", "chore"]

before:
  - "Health check passes"
  - "Evidence approved"
  - "Human verified"

after:
  - "Update STATE.md git.head"
  - "Run health check"
  - "If PASS: update git.lkg"
  - "Clear TASK.md"
  - "Log to LOG.md"
```

## Code Style
```yaml
files:
  max_lines: 300
  structure: "One component/function per file"

naming:
  components: "PascalCase.tsx"
  hooks: "useCamelCase.ts"
  utils: "camelCase.ts"
  types: "PascalCase (with suffix: UserDTO)"
  constants: "SCREAMING_SNAKE"

exports: "Named only, no default, no barrels"
imports: "Absolute @/ paths"

typescript:
  strict: true
  any: forbidden
```
