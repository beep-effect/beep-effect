# Session Route Resolver Spec

## Objective

Given a PR number, branch, lane or checkout, the planned `session resolve`
prints the session that owns it, every message route that session exposes,
the liveness of each route computed at that moment, and the literal tool call
that reaches it, or the fallback to use when none does. Sessions record their
own routes at start, from their environment, with no agent action.

Background, evidence and the full sketch:
[`explorations/session-addressing/BRIEF.md`](../../explorations/session-addressing/BRIEF.md)
and [`RESEARCH.md`](../../explorations/session-addressing/RESEARCH.md).

## Non-Goals

- No mailbox, relay, dispatcher, poller or daemon. The resolver sends nothing.
- No write to another checkout's Yeet inbox.
- No session, thread or environment id in a PR body, commit or tracked file.
- No syncing of ledger or presence files between hosts.
- No change to what a `SessionLedgerRow` means, and no route field on it.
- No attempt to make Codex desktop, Cursor, Grok or Junie sessions receive.
- No parsing of display names as addresses.
- `session open` hiding dead rows, and typed addresses in the orchestrator
  register: both are gated candidates in the exploration's `MAP.md`.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/Session/` in `@beep/repo-cli`:
  new schemas, the presence store, the resolver service and the `resolve`
  subcommand.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Provenance.ts`:
  `PrProvenanceEntrypoint` gains `t3-code`; the harness domain gains the CLI
  workers.
- `.claude/hooks/session-ledger.sh` and `.codex/hooks.json`: append presence
  at session start.
- The `orchestrate` and `closeout` skills: replace the manual owner lookup
  with `session resolve`.

## Constraints

- Design order is schema, then the `Context.Service` contract, then
  implementation. Validate every Effect API against the v4 reference checkout.
- `SessionRoute` is a tagged union keyed by route kind: `t3-thread`,
  `claude-peer`, `via-parent` (recursive), `unroutable`.
- A route stores ids. The current display name is looked up when the send
  call is printed.
- Liveness is computed, never stored: `live`, `dormant`, `unreachable`,
  `dead`, `unknown`. `unknown` is never treated as `dead`.
- Presence is keyed by `sessionId`, lives in workstation state beside the
  ledger, and is never a claim on a checkout.
- Ownership is the newest non-done ledger claim for the key across all
  checkouts; older claims are reported as superseded, not edited.
- A CLI worker that inherits its launcher's `CLAUDE_CODE_SESSION_ID` keeps
  resolving to the launcher. Do not try to separate them in this packet.
- T3 thread ids are opaque and can exceed 300 characters. Store and print
  them verbatim.
- `~/.claude/sessions/*.json`, `~/.codex/state_5.sqlite` and `t3 thread list`
  output are undocumented. Each reader decodes through a schema and degrades
  to `unknown`; none may fail a resolve.
- The CLI cannot call MCP tools. For a key with no local owner the resolver
  prints the per-environment `t3_thread_search` plan for the agent to run.
- Tests use fixture index files and a fixture ledger, never the real home
  directory. Package-scoped checks only; no repo-wide test, coverage or docgen
  run is needed.

## Acceptance Criteria

- [ ] `SessionRoute`, `SessionPresence`, `RouteLiveness` and
      `SessionResolution` exist as schemas with JSDoc examples, and decode
      every route kind from fixtures.
- [ ] A session started in this repo under Claude Code or Codex appends a
      presence row whose routes match its environment: a T3-hosted session
      records `t3-thread` with thread id and environment id; a Claude session
      records `claude-peer`.
- [ ] `session resolve <pr>` for a PR owned by a Claude Desktop session prints
      that session's current name, `live` or `dead`, and a `SendMessage` call.
- [ ] `session resolve <pr>` for a PR owned by a T3-hosted session prints a
      `t3_thread_send` call carrying both ids, and `dormant` when the thread
      is idle.
- [ ] `session resolve` accepts a branch, a lane and a checkout path and
      returns the same owner as the PR number does.
- [ ] After a takeover (a newer ledger claim from another checkout), resolve
      returns the taker and lists the previous owner as superseded.
- [ ] A key with no local owner prints the linked-environment search plan and
      the PR-comment and takeover fallbacks, and exits zero.
- [ ] An unreadable or malformed harness index yields `unknown`, not a
      failure and not `dead`.
- [ ] `--json` output decodes through `SessionResolution`.
- [ ] The `orchestrate` skill names `session resolve` as the way to find an
      owner.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Package gate | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Live proof | the planned `session resolve <pr>` for one Desktop-owned and one T3-owned PR, output saved under `history/` with ids cut to eight characters | Matches `ListAgents` and `t3_thread_read` |
| Packet launcher size | `test "$(wc -m < goals/session-route-resolver/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/session-route-resolver/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/session-route-resolver` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add session-route-resolver --title "..." --reversal "..."`); the block below is
generated from that directory by `bun run beep goals decisions write` and never
edited by hand. Two lanes appending files never conflict; two lanes appending
to this section's tail always did.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug session-route-resolver`; add a `kind: decision` file there, never edit this block._

### Cross-host ownership resolves through T3 PR links per environment, 2026-11-13

Settled in explorations/session-addressing/DECISIONS.md (D5, operator answer). No session or machine id is written to GitHub.

Lane explore/session-addressing

Reverse: Add an opaque route token to the Yeet provenance footer.

### First slice is the resolver plus automatic route stamping, 2026-11-13

Settled in explorations/session-addressing/DECISIONS.md (D7, operator answer).

Lane explore/session-addressing

Reverse: Split presence capture and the resolve command into two packets.

### Presence rows live in <repo>.presence.jsonl beside the ledger and hooks write them with jq, 2026-11-13

The file sits in the sessions state directory as github.com__<owner>__<name>.presence.jsonl, owner-only like the ledger. The SessionStart hook writes the row with jq so session start never pays the CLI's start-up cost; the row's shape is pinned by a test that runs the hook and decodes every line through SessionPresence. session note and session presence write the same row from TypeScript. A Codex process with an inherited CLAUDE_CODE_SESSION_ID writes nothing, so a CLI worker keeps resolving to its launcher.

Lane feat/session-route-resolver

Reverse: Have the hooks call bun run beep session presence instead of writing the row themselves, or move the file to its own state directory.

### Remote T3 threads read unknown unless their link is down, 2026-11-13

The CLI cannot call MCP tools and `t3 thread show` has no environment flag, so a thread on a linked environment reads unknown with a pointer to t3_thread_read, and unreachable only when `t3 environment list` reports its link down. unknown keeps the send call and is never treated as dead. `t3 environment list` pings every link and took about 11 seconds with five links, so it has a 30-second budget and runs only for a remote thread or a key with no local owner.

Lane feat/session-route-resolver

Reverse: Have the resolver call the remote environment through the T3 server when the CLI gains an environment flag for thread show.

### Route liveness is computed at read time and unknown is never dead, 2026-11-13

Settled in explorations/session-addressing/DECISIONS.md (D3). 74 of 128 open ledger rows were over a week old on 2026-11-12.

Lane explore/session-addressing

Reverse: Add a stored liveness field to presence rows.

### Route schema and resolver live in the repo-cli Session command, 2026-11-13

Settled in explorations/session-addressing/DECISIONS.md (D1). The ledger, the register and the harness identity reader already live there.

Lane explore/session-addressing

Reverse: Move the Session/ route modules to a new tooling package and re-export them.

### Routes live in a SessionPresence record keyed by session, 2026-11-13

Settled in explorations/session-addressing/DECISIONS.md (D4, operator answer). A route belongs to a session and ownership belongs to a checkout.

Lane explore/session-addressing

Reverse: Add a routes field to SessionLedgerRow and stop writing the presence file.

### Routes store ids and display names are resolved at send time, 2026-11-13

Settled in explorations/session-addressing/DECISIONS.md (D2). Session names are auto-generated and regenerated.

Lane explore/session-addressing

Reverse: Add a stored name field and send by it.

### Sessions with no inbound route stay unroutable and no relay is built, 2026-11-13

Settled in explorations/session-addressing/DECISIONS.md (D6, operator answer). Such a session resolves via its launcher, else PR comment, else takeover.

Lane explore/session-addressing

Reverse: Open an agent-pool-doctrine ruling that permits a checkout inbox write.

### The Codex thread-table and t3 thread list readers are cut from slice one, 2026-11-13

BRIEF.md names these two as first to cut. Slice one resolves through the ledger, presence and the Claude live index, and reads T3 thread state with `t3 thread show` and link state with `t3 environment list`. A key with no ledger claim prints one t3_thread_search per linked environment, which covers T3-owned work on any host; Codex desktop sessions are discoverable but unroutable either way.

Lane feat/session-route-resolver

Reverse: Add a Codex state_5.sqlite reader and a t3 thread list reader as further claim sources in Resolve.service.ts.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
