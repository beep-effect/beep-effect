# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-11-12 — D1 owning package

**Question:** Which package owns the route schema and the resolver?

**Answer:** `@beep/repo-cli`, in `packages/tooling/tool/cli/src/commands/Session/`,
beside `SessionLedgerRow` and `RegisterRow`. No new package.

**Rationale:** Agent-decided from the repo. The ledger, the orchestrator
register and the harness-identity reader already live there, and the meaning
is repo tooling, not product language. Rejected: a new `tooling/*` package
(nothing else would import it).

## 2026-11-12 — D2 ids are stored, names are resolved late

**Question:** Does a route store the display name a sender types, or the id
behind it?

**Answer:** The id. A Claude route stores `sessionId`; the resolver reads the
current name from `~/.claude/sessions/` when it prints the send call. A stored
name is a hint for humans only.

**Rationale:** Agent-decided from evidence. Names are auto-generated and
regenerated (`nameSource: auto`, T3 `titleRegeneration`), and the capture's
unresolvable "priceless-aryabhata-e503c5" is what a stored name turns into.

## 2026-11-12 — D3 liveness is computed at read time

**Question:** Is liveness a stored field or a computed one?

**Answer:** Computed by the resolver from the harness's own evidence, never
stored. Values: `live`, `dormant` (deliverable, wakes on send), `unreachable`
(host or link down, retry later), `dead`, `unknown`. `unknown` is never
treated as `dead`.

**Rationale:** Agent-decided. 74 of 128 "open" ledger rows are over a week old
and 52 name a checkout that no longer exists, so any stored liveness would be
wrong the same way. The `unknown` rule matches the repo's existing "a failed
read is unknown, never zero".

## 2026-11-12 — D4 route home

**Question:** Where is a session's route stored?

**Answer:** In a new `SessionPresence` record keyed by `sessionId`, in a
workstation state file beside the ledger, written by the SessionStart hook on
every start. Ledger rows keep their meaning (who owns this checkout) and gain
no route field. The resolver joins `row.sessionId` to presence.

**Rationale:** Operator answer, recommended option. A route belongs to a
session; ownership belongs to a checkout. Splitting them means a takeover
needs no route rewrite, the hook can write without claiming a checkout, and an
orchestrator in the main clone gets an address without "owning" main.
Rejected: a `routes` field on `SessionLedgerRow` (the hook could only stamp it
by writing an ownership row), and derive-only (cannot recover the T3 thread of
a session working outside a T3-made worktree, which is most of them).

## 2026-11-12 — D5 cross-host ownership index

**Question:** The ledger is per host. What tells DankStation who owns a PR
whose lane runs on tbk-worker?

**Answer:** T3's own PR links, searched one environment at a time. The
resolver prints the search plan (which environments, which query); the agent
runs it with `t3_thread_search`. No session or machine id is written to
GitHub.

**Rationale:** Operator answer, recommended option. `t3_thread_search "3122"`
on tbk-worker already returns #3122's owning thread. Rejected: a route token
in the Yeet provenance footer (machine and thread ids in a public repo), and
both together.

## 2026-11-12 — D6 kinds with no inbound route

**Question:** Codex desktop, TUI and `exec`, Cursor, Grok and Junie sessions
started outside T3 can be found but cannot receive. Build a way in?

**Answer:** No. The AGENTS.md law stands: no mailbox, relay or dispatcher.
The route schema records such a session as `via-parent` when a T3 thread or
Claude session launched it, otherwise `unroutable` with its native id. The
resolver then falls back to a PR comment, then a takeover thread. Doctrine
gains one line: a session that owns a PR runs as a T3 thread or a Claude
session.

**Rationale:** Operator answer, recommended option. Rejected: letting the
orchestrator write another checkout's Yeet inbox (it is a mailbox, needs a
new agent-pool ruling, and still does nothing across hosts), and deferring.

## 2026-11-12 — D7 first slice

**Question:** Which slice graduates first?

**Answer:** Resolver plus automatic route stamping, as one goal packet:
`SessionRoute` and `SessionPresence` schemas, capture from the environment,
and the planned `session resolve <pr|branch|lane|checkout>`.

**Rationale:** Operator answer, recommended option. It is the smallest slice
that turns the four-step #3172 lookup into one command. Rejected: stamping
only (no benefit until a second slice) and ledger liveness first (hygiene that
does not answer "how do I message the owner").
