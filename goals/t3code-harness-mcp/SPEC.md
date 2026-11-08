# T3 Code Harness MCP Spec

## Objective

A session started outside T3 Code can reach T3 sessions through one MCP
server named `t3-hub`. That covers terminal Claude Code, Codex, Grok,
cursor-agent and Junie on any live host. `t3-hub` is the DankStation T3
environment, and Linked environments carry calls on to the other hosts.

**As built:** each host registers its own `t3-code` entry instead of a shared `t3-hub`
(decision `per-host-t3-code-replaces-t3-hub`). `t3-hub` below is the original design.

Graduated from [explorations/t3code-fleet-driver](../../explorations/t3code-fleet-driver/README.md).
The settled decision is `outside-harness-mcp` in its
[DECISIONS.md](../../explorations/t3code-fleet-driver/DECISIONS.md).
Per-harness facts are in
[harness-mcp-surfaces.md](../../explorations/t3code-fleet-driver/research/harness-mcp-surfaces.md).

## Non-Goals

- A repo-owned config writer. That stays the `agent-config-canonicalization`
  INBOX item.
- Registering in sessions T3 launches. They already get the injected
  `t3-code` server.
- One grant per environment, and grants narrower than Full access.
- Changing any other MCP server's configuration.

## Source Hierarchy

1. The exploration's DECISIONS.md.
2. `AGENTS.md`, `CLAUDE.md`, the global 1Password and secret rules.
3. This `SPEC.md`.
4. `PLAN.md`.
5. `GOAL.md`.

## Target Surfaces

- User-scope MCP configuration for each harness on DankStation first, then
  on each host that `goals/t3code-fleet-rollout` brings up:
  - Claude Code: `claude mcp add -t http`, user scope.
  - Codex: `codex mcp add --url` plus `codex mcp login`.
  - Grok: `grok mcp add`.
  - cursor-agent: edit its JSON config, then `agent mcp login`.
  - Junie: edit its JSON config. OAuth support is unverified; prove it or
    record it as unsupported.
- The per-harness recipe, how to verify it, and how to renew it go in the
  fleet runbook (a new `t3code-fleet` runbook under the runbooks docs), or in
  `docs/runbooks/agent-pools.md` if the fleet runbook has not landed yet.
- A renewal reminder for the 30-day OAuth grants and Linked-environment
  links, using the existing reminder-timer pattern
  (`docs/runbooks/systemd-timers.md`).

## Constraints

- OAuth completes only over HTTPS or loopback, so harnesses use the hub's
  Tailscale HTTPS URL. Tokens stay in each harness's own credential store.
  Never print, commit or copy tokens between hosts.
- The name is `t3-hub`, distinct from T3's injected `t3-code`.
- Run a live check before rolling out beyond DankStation. A T3-launched
  Claude session and a T3-launched Codex session must not load `t3-hub` as
  well as `t3-code`. If they do, resolve it (for example with project-scope
  exclusion) and record the fix.
- Approving a pairing request is the operator's action in T3 Settings; agents
  surface the request and wait.

## Acceptance Criteria

- [x] On DankStation, a terminal session in each of the five harnesses
      lists T3 tools and reads one owned thread through `t3-hub`. Junie may
      instead be recorded as unsupported, with evidence.
- [x] The double-load check passes, or its recorded fix is applied.
- [x] The same registration is repeated on every host brought up by the
      fleet rollout.
- [x] A renewal reminder fires before the 30-day expiry.
- [x] The recipe is merged through `/yeet`. Sanitized receipts are in
      `history/`.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Registered | Each harness's `mcp list` (names only) | `t3-hub` present |
| Reachable | One `t3_thread_read` per harness | Succeeds |
| No double-load | Tool list inside a T3-launched Claude session and a T3-launched Codex session | Only `t3-code` |
| Repo | `bun run beep yeet verify` | Passes |

## Stop Conditions

- A harness cannot complete OAuth against T3. Record it and move on to the
  next harness.
- Any spend.
- The same blocker repeats after reasonable investigation.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-11-01 | One `t3-hub` entry per harness, with Full-access OAuth on the DankStation environment | Smallest renewal surface; Full access is needed to send | Remove the entries and revoke the grants in T3 Settings |

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

The operator ruled on 2026-11-08 that these three goals reach completed-retained in one single PR, regardless of the packets' two-PR closeout, to keep the merge queue clear. So this PR commits status completed-retained with a closeout record naming itself, instead of a proposedCloseout adopted later. That puts the committed record ahead of its evidence: set-status guards only the proposal path, and no completion receipt can exist before the merge. The check runs afterward: goals completion refresh on this lane, from which a failure reopens the packet.

Lane `t3code-goals-closeout`

Reverse: Run goals set-status <slug> active, which turns the closeout record back into a proposal, in a packet-state PR

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Junie harness turn not proven | All hosts; a Junie turn calling `t3-code`. The stored token is proven by direct MCP calls | Fleet orchestrator | DankStation's JetBrains balance is spent (buying more is the operator's call); workers have no JetBrains login and copying credentials is out of scope (`history/2026-11-08-harness-matrix.md`) | A Junie turn lists and reads a thread on a host with credits and a login |
