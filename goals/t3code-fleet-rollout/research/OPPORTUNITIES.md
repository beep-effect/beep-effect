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

## 2026-11-08 — T3 restart leaves a dead AppImage mount on PATH

- Doing: `yeet final-check` for the closeout PR.
- Evidence: 66 failed repo-cli tests with `spawn ENOTCONN` and `spawnSync tar ENOTCONN` on a docs-only
  diff. After the T3 desktop restart, the inherited PATH still named the old `/tmp/.mount_T3-Cod*`, whose
  FUSE mount was dead, ahead of `/usr/bin`. Stripping it made the same `tar` spawn pass, and the gate went clean.
- Would have prevented it: T3 keeping its AppImage mount off the PATH it hands to sessions, or Yeet naming a
  dead PATH entry before running gates.

## 2026-11-08 — live home-relative paths pass hosted CI on a docs-only PR

- Doing: the same final-check.
- Evidence: `knowledge refs --check: 8 live host-path observation(s)`, from `~/` paths in a decision file and
  its `SPEC.md` projection, while the PR showed 15 of 15 hosted checks green.
- Would have prevented it: running `knowledge refs --check` in `yeet publish`'s cheap gates.
