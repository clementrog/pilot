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
