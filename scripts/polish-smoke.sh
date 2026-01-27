#!/usr/bin/env bash
set -euo pipefail

# Deterministic smoke test for pilot polish changes
# Requirements: node, git (no external deps)

ENGINE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SANDBOX="$ENGINE_DIR/sandbox/polish-ws2"

echo "=== Polish Smoke Test ==="
echo "Engine dir: $ENGINE_DIR"

# 1) Clean sandbox
rm -rf "$SANDBOX"
mkdir -p "$SANDBOX"
echo "[1/7] Created sandbox: $SANDBOX"

# 2) Init workspace
node "$ENGINE_DIR/dist/cli.js" init --workspace "$SANDBOX"
echo "[2/7] Initialized workspace"

# 3) Git init + commit baseline (NOT STATE/TASK) + enable allowDirtyWorkspace + create TASK
cd "$SANDBOX"
git init -q
git config user.email "smoke@test.local"
git config user.name "Smoke Test"
git add .gitignore MANIFEST.json ROADMAP.json
git commit -q -m "baseline"
WS="$ENGINE_DIR/sandbox/polish-ws2"
mkdir -p "$(dirname "$WS")"
# Enable allowDirtyWorkspace so uncommitted STATE/TASK don't block (tests the P1 opt-in)
node -e "const fs=require('fs'),p=process.argv[1],s=JSON.parse(fs.readFileSync(p,'utf8'));s.config=s.config||{};s.config.safety=s.config.safety||{};s.config.safety.allowDirtyWorkspace=true;fs.writeFileSync(p,JSON.stringify(s,null,2));" "$WS/STATE.json"
# Create a simple TASK.json for the smoke test
cat > TASK.json << 'TASK_EOF'
{
  "id": "smoke-task-001",
  "status": "ready",
  "title": "Create SMOKE.txt",
  "description": "Create a file SMOKE.txt with content OK",
  "scope": { "allowed": ["."], "forbidden": [] }
}
TASK_EOF
echo "[3/7] Git baseline committed, allowDirtyWorkspace enabled, TASK created"

# 4) Create mock cursor-agent
mkdir -p tools
cat > tools/mock-cursor-agent.sh << 'CURSOR_EOF'
#!/usr/bin/env bash
# Mock cursor-agent: writes SMOKE.txt and REPORT.json
WS_DIR="$(pwd)"
echo "OK" > "$WS_DIR/SMOKE.txt"
# Extract task_id from TASK.json
TASK_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$WS_DIR/TASK.json','utf8')).id)")
cat > "$WS_DIR/REPORT.json" << EOF
{
  "task_id": "$TASK_ID",
  "status": "done",
  "summary": ["Created SMOKE.txt"],
  "files_changed": ["SMOKE.txt"],
  "questions": []
}
EOF
CURSOR_EOF
chmod +x tools/mock-cursor-agent.sh
echo "[4/7] Created mock-cursor-agent.sh"

# 5) Create mock opencode
cat > tools/mock-opencode.sh << 'OPENCODE_EOF'
#!/usr/bin/env bash
# Mock opencode: outputs valid orchestrator JSON
cat << 'JSON'
{"status":"ok","writes":{"pilot/STATE.json":{"status":"complete"}},"notes":["mock patch"]}
JSON
OPENCODE_EOF
chmod +x tools/mock-opencode.sh
echo "[5/7] Created mock-opencode.sh"

# 6) Run pilot with mocks
echo "[6/7] Running pilot..."
export PILOT_CURSOR_BIN="./tools/mock-cursor-agent.sh"
export PILOT_OPENCODE_BIN="./tools/mock-opencode.sh"
node "$ENGINE_DIR/dist/cli.js" run --once --workspace . || true
echo ""

# 7) Assertions
echo "[7/7] Assertions..."
FAIL=0

# STATE.status == "complete"
STATUS=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).status)" "$WS/STATE.json" 2>/dev/null || echo "ERROR")
if [ "$STATUS" = "complete" ]; then
  echo "  [PASS] STATE.status == complete"
else
  echo "  [FAIL] STATE.status == '$STATUS' (expected 'complete')"
  FAIL=1
fi

# SMOKE.txt exists and equals OK
if [ -f "SMOKE.txt" ]; then
  SMOKE_CONTENT=$(cat SMOKE.txt)
  if [ "$SMOKE_CONTENT" = "OK" ]; then
    echo "  [PASS] SMOKE.txt exists and equals 'OK'"
  else
    echo "  [FAIL] SMOKE.txt content is '$SMOKE_CONTENT' (expected 'OK')"
    FAIL=1
  fi
else
  echo "  [FAIL] SMOKE.txt does not exist"
  FAIL=1
fi

# BLOCKED.json does not exist
if [ ! -f "BLOCKED.json" ]; then
  echo "  [PASS] BLOCKED.json does not exist"
else
  echo "  [FAIL] BLOCKED.json exists (should not)"
  cat BLOCKED.json
  FAIL=1
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "=== ALL ASSERTIONS PASSED ==="
  exit 0
else
  echo "=== SOME ASSERTIONS FAILED ==="
  exit 1
fi
