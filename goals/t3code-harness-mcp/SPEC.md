# T3 Code Harness MCP Spec

## Objective

A session started outside T3 Code can reach T3 sessions through one MCP server named
`t3-code`. That covers terminal Claude Code, Codex, Grok, cursor-agent and Junie on any live
host. Each entry points at that host's own T3 environment, and Linked environments carry calls
on to the other hosts.

The exploration's shared `t3-hub` entry on the DankStation environment was replaced before
this packet closed (decision `per-host-t3-code-replaces-t3-hub`); it survives here only as
history.

Graduated from [explorations/t3code-fleet-driver](../../explorations/t3code-fleet-driver/README.md).
Per-harness facts are in
[harness-mcp-surfaces.md](../../explorations/t3code-fleet-driver/research/harness-mcp-surfaces.md).

## Non-Goals

- A repo-owned config writer. That stays the `agent-config-canonicalization`
  INBOX item.
- Automatic renewal, which the operator declined on 2026-11-08.
- One grant per environment, and grants narrower than Full access.
- Changing any other MCP server's configuration.

## Source Hierarchy

1. The exploration's DECISIONS.md.
2. `AGENTS.md`, `CLAUDE.md`, the global 1Password and secret rules.
3. This `SPEC.md`.
4. `PLAN.md`.
5. `GOAL.md`.

## Target Surfaces

- User-scope MCP configuration for each harness on every live host, pointing at that host's
  loopback T3 with a per-harness bearer token. Per-harness locations are in the fleet runbook,
  "Harness MCP registration and renewal", with the recipe, verification and renewal.
- A one-shot renewal reminder before the 180-day expiry, using the existing reminder-timer
  pattern on DankStation.

## Constraints

- `/mcp` accepts only MCP OAuth tokens, and they have no refresh. Tokens stay in each harness's
  own configuration at mode 600. Never print, commit or copy tokens between hosts.
- The name is `t3-code`, the same key T3 injects, so the injected thread-scoped entry replaces
  the user-scope one. A T3-launched Claude session and a T3-launched Codex session must not
  expose T3 tools under two names.

## Acceptance Criteria

- [x] On every live host, a terminal session in Claude Code, Codex, Grok and cursor-agent lists
      and reads a thread through `t3-code`.
- [x] Junie's stored token lists and reads a thread by direct MCP calls on every live host. A
      Junie turn is not proven; see the Exception Ledger.
- [x] The double-load check passes.
- [x] A renewal reminder is armed before the 2027-05-07 expiry, and its test fire posted.
- [x] The recipe is in the fleet runbook. Sanitized receipts are in `history/`.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Registered | Each harness's `mcp list` or config (names only) | `t3-code` present |
| Reachable | One `t3_thread_read` per harness per host (`history/2026-11-08-harness-matrix.md`) | Succeeds; Junie by token |
| No double-load | Tool list inside a T3-launched Claude session and a T3-launched Codex session | No T3 tool under two names |
| Repo | `bun run beep yeet final-check` | Passes |

## Stop Conditions

- A harness cannot complete OAuth against T3. Record it and move on to the
  next harness.
- Any spend.
- The same blocker repeats after reasonable investigation.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-11-01 (superseded 2026-11-08) | One `t3-hub` entry per harness, with Full-access OAuth on the DankStation environment | Smallest renewal surface; Full access is needed to send | Remove the entries and revoke the grants in T3 Settings |

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug t3code-harness-mcp`; add a `kind: decision` file there, never edit this block._

### Each host registers its own t3-code entry, replacing the shared t3-hub, 2026-11-08

As built on 2026-11-08, every harness on every host has a user-scope entry named t3-code pointing at that host's loopback T3, with a per-harness OAuth token in an Authorization header, instead of one t3-hub entry on the DankStation environment over Tailscale HTTPS. The operator confirmed this state as the fleet's configuration. Calls no longer depend on the hub being up. Sharing T3's injected name means the injected entry replaces the user-scope one, which is the double-load fix the spec asked for. Costs: a bearer token sits in each harness config (mode 600), and a Linked environment is one hop further from an outside session.

Lane `t3code-goals-closeout`

Reverse: Remove each t3-code entry, register t3-hub per the original SPEC, and revoke the grants in T3 Settings

### Renewal is a one-shot reminder at 180 days, with no automatic renewal, 2026-11-08

The fork raised MCP_CLIENT_SESSION_TTL to 180 days (beep-effect/t3code#2), so tokens and links expire 2027-05-07, and the operator declined auto-renew timers on 2026-11-08. A reminder is what the spec requires and renews nothing by itself: a one-shot DankStation timer notifies on 2027-04-23. The authorize script sits at a durable local path because tracked Python is banned.

Lane `t3code-goals-closeout`

Reverse: Disable t3code-fleet-renewal-reminder.timer and delete its two units

### Closeout lands in one PR by operator ruling, 2026-11-08

The operator ruled on 2026-11-08 that these three goals reach completed-retained in one single PR, regardless of the packets' two-PR closeout, to keep the merge queue clear. So this PR commits status completed-retained with a closeout record naming itself, instead of a proposedCloseout adopted later. That puts the committed record ahead of its evidence: set-status guards only the proposal path, and no completion receipt can exist before the merge. The session that owns the closeout lane runs the refresh after merge and reads each packet's outcome; if that session has ended, the orchestrator does. Refresh records an outcome without failing or reopening anything, so for any outcome other than verified, that owner opens a packet-state PR reopening the packet.

Lane `t3code-goals-closeout`

Reverse: In a packet-state PR, run goals set-status <slug> active, delete the proposedCloseout it leaves (a matching verified receipt would otherwise still project the packet as completed), and set the reopened phase back to pending

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Junie harness turn not proven | All hosts; a Junie turn calling `t3-code`. The stored token is proven by direct MCP calls | Fleet orchestrator | DankStation's JetBrains balance is spent (buying more is the operator's call); workers have no JetBrains login and copying credentials is out of scope (`history/2026-11-08-harness-matrix.md`) | A Junie turn lists and reads a thread on a host with credits and a login |
