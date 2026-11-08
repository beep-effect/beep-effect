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

## 2026-11-08 — version-pinned AppArmor profile breaks on Cursor auto-update

- Doing: harness proof matrix on beep-worker.
- Evidence: `SandboxUnsupportedError ... Linux preflight failed with exit code 2`, starting when
  cursor-agent auto-updated between two passes. The profile also still named a T3 runtime from October.
- Would have prevented it: a host check that compares the profile's pinned paths with the running
  helpers. T3's runtime path changes with every fork publish, so its pin goes stale at each one.

## 2026-11-08 — grok-bot sleeps between calls

- Doing: closeout probes.
- Evidence: the link read `unreachable`, then `reachable`, then `delegate_task` returned "did not answer",
  then the next call worked, all within about 10 minutes and with no action from the operator.
- Would have prevented it: a wake-and-hold command for the box, or a retry in the proof path.
