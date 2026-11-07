# Opportunities

Friction receipts for `t3code-fleet-rollout`, recorded as they happen.

## 2026-11-07 — headless Claude turn hangs on unapproved project MCP servers

- Doing: P2 per-host delegated turn on beep-worker.
- Evidence: three turns failed after 90 s with "Claude timed out while registering its MCP
  tools"; the server trace showed `orchestration-v2.claude-mcp-registration-timeout`
  (`ClaudeAdapterV2.ts`, `setMcpServers` never resolved). `claude mcp list` in the target
  checkout listed five `.mcp.json` servers at "Pending approval".
- Would have prevented it: the T3 adapter reporting pending-approval project servers by
  name (or failing fast) instead of waiting out the timeout; and the host bootstrap
  recording an approve/disable decision for every `.mcp.json` server of a project it
  registers.
