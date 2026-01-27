#!/usr/bin/env bash
# Mock opencode: outputs valid orchestrator JSON
cat << 'JSON'
{"status":"ok","writes":{"pilot/STATE.json":{"status":"complete"}},"notes":["mock patch"]}
JSON
