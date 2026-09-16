# Agent Pool Picker Spec

## Objective

A `beep agent-pool pick` command that turns the doctrine in `goals/agent-pool-doctrine` into one
printed launch command, so orchestrators run what it prints instead of reading dashboards (D2, D10).

## Non-Goals

- Any Cursor usage read against private endpoints (D17).
- Launching the lane itself (the picker prints; the orchestrator runs).
- Changing the seat map or floors (owned by Goal A / `AGENTS.md`).

## Source Hierarchy

1. `AGENTS.md` "Volume pools" and `docs/runbooks/agent-pools.md` (after Goal A merges).
2. `explorations/cursor-agent-pool/DECISIONS.md` D3, D7, D8, D16, D17, D18.
3. Codex app-server protocol: `codex app-server generate-json-schema` (`account/rateLimits/read`).

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/AgentPool/**` — schemas, `CodexMeter` service, command.
- `packages/tooling/library/ai-metrics` evidence-root convention for the dry-marker path
  (`$XDG_STATE_HOME/beep/agent-pools/cursor-dry-<UTC day>`).
- Lane wrapper hook: the runbook's recipe writes the dry marker on the limit signature.

## Constraints

- Schema first (`PoolSnapshot`, `Tier`, `Seat` as `LiteralKit` ids with bucket, `LaneCommand`), then
  the `Context.Service` contract, then implementation; Effect v4; HashMap/HashSet only.
- Codex "available" = union over admitted accounts above 5%; start with the CLI account; add proxy
  accounts only via a documented CLIProxyAPI surface.
- Output is deterministic and machine-readable (`--json`) as well as a copy-paste command.
- `hold` output names every reason (which pool, which window, reset time).

## Acceptance Criteria

- `beep agent-pool pick --tier volume` prints a `codex exec` command when Codex is above floor, a
  `cursor-agent -p` command on `composer-2.5` when not and no dry marker exists, and `hold` otherwise.
- Unit tests cover the decision table with recorded `account/rateLimits/read` fixtures.
- `bun run beep quality package-verify @beep/repo-cli` passes.

## Verification Matrix

| Claim | Command |
| --- | --- |
| Decision table | package tests with fixtures for 100% / 6% / 4% used and dry-marker present/absent |
| Live probe | `beep agent-pool pick --json` against the workstation (after P1 adds the command) |

## Stop Conditions

- The Codex app-server protocol removes or renames `account/rateLimits/read`.
- Goal A's seat map changes mid-implementation (resync, do not fork).

## Exception Ledger

None.
