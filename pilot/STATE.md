# STATE
```yaml
project: ""
repo: ""

git:
  branch: main
  head: null
  lkg: null

health:
  status: UNKNOWN
  checked_at: null
  command: "pnpm tsc --noEmit && pnpm test"

task:
  id: null
  step: idle
  
blocked: null

next: "Fill project/repo above, then say 'status'"
```

## Steps

| Step | Meaning | Next Action |
|------|---------|-------------|
| `idle` | No active task | Write spec in TASK.md |
| `building` | AI implementing | Wait for evidence |
| `verifying` | Checking evidence | Approve or reject |
| `done` | Ready to commit | Commit and clear |

## Commands

| Say | Does |
|-----|------|
| `status` | Show current state |
| `health` | Run health check |
| `next` | Advance workflow |
| `stuck` | Get help |
| `undo` | Get revert command |
| `restore` | Rollback to LKG |
