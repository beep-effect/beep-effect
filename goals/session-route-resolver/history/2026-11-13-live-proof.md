# Live proof: `session resolve` on DankStation, 2026-11-13

Run from `feat/session-route-resolver` at `5a274f2b146` against the real
workstation ledger, presence file, Claude live index and the local `t3` CLI.
Session, thread and environment ids are cut to eight characters and home paths
are written `~`.

## T3-owned PR: #3297 (this goal's PR)

This session is a Claude Code session hosted by a T3 thread. Its SessionStart
hook and its `session note --pr 3297` recorded presence with both routes.

```text
[session:resolve] 3297: owner session-route-resolver (feat/session-route-resolver, PR #3297) open by claude-code session 561ff11e, claimed 2026-11-13T21:35:19.369Z (matched pr)
  checkout: ~/YeeBois/projects/beep-effect-worktrees/session-route-resolver
  route t3-thread: live (thread is running)
    send: t3_thread_send({ threadId: "1cc1115e", environmentId: "17d7708d", message: "<message>" })
  route claude-peer "/goal follow the instructions in goals/session-rou...": live (pid 1689359 is running)
    send: SendMessage({ to: "/goal follow the instructions in goals/session-rou...", message: "<message>" })
  1. send: t3_thread_send({ threadId: "1cc1115e", environmentId: "17d7708d", message: "<message>" })
```

`t3_thread_read` on thread `1cc1115e` returned the same thread: link
`t3-thread://v2/17d7708d…/1cc1115e…`, `status: "running"`,
`archived: false`, and `pullRequests` containing #3297 (`state: "open"`).
`ListAgents` named this session `/goal follow the instructions in
goals/session-rou... [c79a7d]`, the same string the resolver printed.

The `dormant` reading for an idle T3 thread is covered by the fixture test
"resolves a T3-owned PR to t3_thread_send with both ids, dormant while the
thread is idle"; no idle T3-owned PR with presence existed at proof time.

## Claude peer owners: #3214 live, #3279 dead

```text
[session:resolve] 3214: owner explore-citation-engine-7118d0fa921660ae (explore/citation-engine-install-and-worker-reuse, PR #3214) blocked by claude-code session 2c123cfe, claimed 2026-11-13T06:14:17.368Z (matched pr)
  route claude-peer "Citation engine: per-request install & worker reuse": live (pid 2169848 is running)
    send: SendMessage({ to: "Citation engine: per-request install & worker reuse", message: "<message>" })
  1. send: SendMessage({ to: "Citation engine: per-request install & worker reuse", message: "<message>" })

[session:resolve] 3279: owner t3-d3b339ec-c456dc74419470d3 (fix/ep97-github-ledger-coverage, PR #3279) blocked by claude-code session 96651b55, claimed 2026-11-13T18:17:12.760Z (matched pr)
  route claude-peer: dead (no Claude live index entry for this session)
  1. pr-comment: bun run beep yeet gh pr comment 3279 --body "<message>"
  2. takeover: If the owner is dead and work is owed: confirm the lane is not live, then bun run beep worktree new takeover-3279 ...
```

`ListAgents` listed `Citation engine: per-request install & worker reuse
[d0357d]` (idle), the name the resolver printed for #3214. Session `96651b55`
had no file in `~/.claude/sessions/`, so `dead` for #3279 is correct. Earlier
in the run, #3275's owner resolved to `CI goals finish: drive every CI goal to
completed-retained`, matching its `ListAgents` row `[7cb44c]`; its lane has
since written a `done` row.

Both of these owners are T3-hosted Claude sessions that started before the
presence hook existed, so they resolve through the `claude-peer` route their
harness implies. Their `t3-thread` route appears once they restart or run
`session note`.

**Desktop-owned PR.** At proof time `ListAgents` showed three Claude Desktop
sessions, and none owned an open ledger row, so no live Desktop-owned PR
existed on this host. A Desktop session resolves through the same
`claude-peer` path as the peers above. The fixture test "resolves a
Desktop-owned PR to its live peer, its current name and a SendMessage call"
covers it with a `claude-desktop` index entry for a live pid.

## No local owner: #3172

```text
[session:resolve] 3172: no owner on this host
  1. search-environments: this host: t3_thread_search({ query: "3172", environmentId: "17d7708d" })
  2. search-environments: beep-worker (reachable): t3_thread_search({ query: "3172", environmentId: "50c45325" })
  3. search-environments: dankserver (reachable): t3_thread_search({ query: "3172", environmentId: "f697dff6" })
  4. search-environments: grok-bot-vm-402905734 (reachable): t3_thread_search({ query: "3172", environmentId: "44ac08a2" })
  5. search-environments: tbk-worker (reachable): t3_thread_search({ query: "3172", environmentId: "fb1ee9a0" })
  6. search-environments: tom-pc-1-wsl (reachable): t3_thread_search({ query: "3172", environmentId: "73e583dc" })
  7. pr-comment: bun run beep yeet gh pr comment 3172 --body "<message>"
  8. takeover: ...
```

#3172's lane wrote its `done` row when it merged, so no claim remains and the
resolver prints the per-environment search plan and exits zero. The six
environment ids and statuses match `t3 environment list --json`.

## Codex desktop owner (earlier in the run): #3278

Before its lane wrote `done`, #3278 resolved to a Codex desktop session:
`route unroutable: unknown (Codex outside T3 accepts no inbound message)`,
then the PR-comment and takeover steps.
