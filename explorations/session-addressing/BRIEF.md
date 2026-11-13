# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

## Problem

The orchestrator can send a message to almost any session and cannot find the
one it wants. Sends are keyed by a display name or a T3 thread id; work is
keyed by PR, branch and lane; nothing joins the two.

On 2026-11-12 finding #3172's owner took four manual steps. #3122's owner was
called unreachable although it was one `t3_thread_search` away on tbk-worker.
#3171's owner was handed over under a name that was never a session title.

Research ([`RESEARCH.md`](./RESEARCH.md)) changed the shape of the problem in
three ways:

- The keys already exist, in four places: the session ledger, Claude's live
  index (`~/.claude/sessions/<pid>.json`), T3's thread store and Codex's
  thread table. The work is a join plus one captured fact.
- The one fact nobody captures is the T3 address of a session that works
  outside a T3-made worktree. The session can read it from its own
  environment (`T3CODE_THREAD_ID`) and one file.
- Only two kinds of session can receive a message: T3 threads on any linked
  environment and Claude sessions on the same host. No amount of metadata
  makes the others reachable.

## Appetite

One goal packet, two to three focused days, all inside `@beep/repo-cli`'s
Session command, verified with package-scoped checks. If the resolver is not
answering the three capture cases (#3172, #3122, #3171's shape) by the end of
day two, cut the Codex thread-table reader and the `t3` CLI reader and keep
ledger, presence and the Claude index. Never cut liveness: an address without
it repeats today's problem.

## Solution Sketch

Design order is schema, then the `Context.Service` contract, then
implementation. The shapes below are fat-marker pseudocode, not validated
Effect v4.

### 1. Route: a tagged union keyed by route kind

```ts
SessionRoute =
  | { _tag: "t3-thread",   environmentId, threadId, provider }
  | { _tag: "claude-peer", sessionId, nameHint: Option<string> }
  | { _tag: "via-parent",  parent: SessionRoute, childKind }   // recursive, S.suspend
  | { _tag: "unroutable",  harness, nativeId: Option<string>, reason }

childKind = agent-tool | workflow | t3-child | codex-subagent | cli-worker
```

- `t3-thread` is durable: a send to an idle thread starts it. It is the only
  route that crosses hosts.
- `claude-peer` works only on the host that runs the process. The sender
  looks up the current name by `sessionId` (D2).
- `via-parent` covers Agent-tool and Workflow children, T3 child threads and
  CLI workers launched by a session.
- `unroutable` is a first-class answer. It keeps the native id so a takeover
  can read the session's history.

### 2. Presence: a session's routes, keyed by session

```ts
SessionPresence {
  schemaVersion: "session-presence/v1"
  repository, harness, entrypoint, sessionId
  routes: Array<SessionRoute>          // preferred first
  checkout, branch                      // where it started; not ownership
  recordedAt
}
```

Stored as JSON Lines in workstation state beside the ledger, newest row per
`sessionId` wins. Written by the SessionStart hook for Claude and Codex, and
again by `session note` and Yeet's provenance capture, all from the
environment: `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_ENTRYPOINT`,
`T3CODE_THREAD_ID`, the T3 environment id, `CODEX_THREAD_ID`. No agent has to
remember anything.

The ledger row is unchanged (D4). Two literal domains it borrows from Yeet
provenance are widened: `PrProvenanceEntrypoint` gains `t3-code`, and the
harness domain gains the CLI workers.

### 3. Resolution

```text
query (PR | branch | lane | checkout)
  -> candidate owners
       ledger: newest non-done row matching the key, across all checkouts
       Codex thread table: thread by git_branch or cwd
       local t3 CLI: thread by branch, worktree or linked PR
  -> owner = newest claim; older claims listed as superseded
  -> routes = presence[owner.sessionId].routes, else derived from the harness index
  -> liveness per route
  -> the exact send call, or the fallback rung
```

The planned `session resolve <key> [--json]` prints the owner, every route
with its liveness, and the literal call to make (`t3_thread_send` with its
ids, or `SendMessage` with the current name). It sends nothing.

When nothing local matches, it prints the cross-host plan: the linked
environments to search and the query to run (D5). That step is the agent's,
because the CLI cannot call MCP tools.

**Takeover.** The taker writes a ledger row for the PR from its own checkout.
Newest claim wins, so the route follows with no edit to the old row, which
the resolver reports as superseded.

**Liveness** (D3):

| Route | `live` | `dormant` | `unreachable` | `dead` |
| --- | --- | --- | --- | --- |
| `claude-peer` | index file for the `sessionId`, pid alive, same `procStart` | never | never | no index file or pid gone |
| `t3-thread` | thread running or waiting | thread idle or completed, not archived | environment link down or asleep | thread archived or missing |
| `via-parent` | parent's | parent's | parent's | parent's |
| `unroutable` | n/a | n/a | n/a | n/a |

Anything that cannot be read is `unknown`.

### 4. Fallback ladder

1. A `live` route: send.
2. A `dormant` T3 thread: send; it wakes.
3. `via-parent`: send to the parent, naming the child.
4. No route, or only `dead` ones: comment on the PR through Yeet. It reaches
   an owner that runs a monitor, and it is a public record either way.
5. Owner dead and work still owed: check lane liveness, then launch a
   takeover thread on the PR's branch. The takeover's first act is its ledger
   row.

`unreachable` is not a reason to drop down the ladder at once: retry, then
treat as rung 4.

## Rabbit Holes

- **Inherited environment.** A CLI worker launched from a Claude shell
  inherits `CLAUDE_CODE_SESSION_ID`, and the identity reader checks Claude
  first, so the worker records its parent's id. Keep that: it is the correct
  `via-parent` answer. Do not try to tell the two apart in slice one.
- **Codex inside T3.** No field maps a Codex thread id to its T3 `threadId`.
  Whether a T3-hosted Codex session sees `T3CODE_THREAD_ID` is unverified;
  the goal's first task is to check from inside one. If it does not, that
  kind resolves through the T3 CLI by worktree or PR only.
- **`t3 thread list` is per project and has no environment flag.** The local
  reader may be slow at 990 threads; cap it and say so in the output.
- **Opaque, long thread ids.** Some exceed 300 characters with nested percent
  encoding. Store and print them verbatim; never parse or shorten them.
- **Harness files are not a contract.** `~/.claude/sessions/*.json` and
  `~/.codex/state_5.sqlite` are undocumented. Each reader decodes through a
  schema and degrades to `unknown`, never fails the resolve.
- **Presence written from every clone.** The hook runs in every session,
  including ones that own nothing. That is intended; presence is not a claim.

## No-Gos

- No mailbox, relay, dispatcher, poller or daemon. Nothing here sends.
- No write to another checkout's Yeet inbox.
- No session, thread or environment id in a PR body, commit or tracked file.
- No syncing of ledger or presence files between hosts.
- No change to what a ledger row means, and no route field on it.
- No attempt to make Codex desktop, Cursor, Grok or Junie sessions receive.
- No parsing of display names as addresses.
