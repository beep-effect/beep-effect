# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

All probes below ran on 2026-11-12 (ledger timestamps are UTC, so they read
2026-11-13) from one Claude session hosted in a T3 thread on DankStation.
Home paths are written `~`; ids are cut to eight characters.

## External Landscape

Not surveyed. The question is what the harnesses installed on this fleet
expose, and that is answered by probing them, not by reading about them. Every
claim in this file cites a command run on this machine or a T3 MCP call. No
external URL is cited anywhere in the packet.

## Session Census (2026-11-12)

### Summary

| # | Session kind | Stable address | Where it is discoverable | Inbound route | Liveness signal |
| --- | --- | --- | --- | --- | --- |
| 1 | Claude Code, entrypoint `claude-desktop` | `sessionId` (uuid); display `name` is the send key | `~/.claude/sessions/<pid>.json`; `ListAgents` | `SendMessage` by name, same host only | index file exists, pid alive, `status` busy or idle |
| 2 | Claude Code, entrypoint `cli` | same | same | same | same |
| 3 | Claude Code hosted by a T3 thread, entrypoint `t3-code` | `sessionId` and T3 `threadId` + `environmentId` | both of the above, plus `T3CODE_THREAD_ID` in its own environment | `t3_thread_send` (any linked env) or `SendMessage` (same host) | T3 thread status; env link status |
| 4 | T3 thread on another provider (Codex seen) | T3 `threadId` + `environmentId` | `t3_thread_list`, `t3_thread_search`, `t3_thread_read` | `t3_thread_send` | same |
| 5 | T3 child thread (`subagent`, `delegated-task`, provider-native) | child `threadId`, `parentThreadId` | `t3_thread_list` with `includeSubagents`; never in search | send starts a fresh task on a finished child; the parent is the working route | parent's |
| 6 | Claude Agent-tool and Workflow children | none of their own | parent transcript only | parent session | parent's |
| 7 | Codex desktop, TUI, `codex exec`, IDE plugin, outside T3 | Codex thread id (uuid v7) | `~/.codex/state_5.sqlite` table `threads` | none while live; `codex exec resume <id>` starts a new turn | none exposed |
| 8 | Cursor agent CLI | chat uuid | `~/.cursor/chats/<hash>/<uuid>`, `~/.cursor/acp-sessions/` | none | none exposed |
| 9 | Grok CLI | session keyed by encoded cwd | `~/.grok/sessions/`, `~/.grok/active_sessions.json` | none | `active_sessions.json` (empty at probe) |
| 10 | Junie CLI | `session-<stamp>-<id>` | `~/.junie/sessions/`, `~/.junie/processes/<pid>-<session>.json` | none | process file |
| 11 | Any non-T3 session on a remote host | whatever rows 1, 2, 7 to 10 give, on that host | that host's disk only | none from here | none from here |

Rows 8 to 10 are listed from directory layout only. I did not open their
session files or test a send, so their "none" means "no inbound interface was
found", not "proven absent".

### 1 and 2. Claude Code sessions on this host

Claude Code keeps a live index, one file per running process, at
`~/.claude/sessions/<pid>.json`. Field union across the 37 files present:
`pid`, `procStart`, `sessionId`, `cwd`, `name`, `nameSource`, `nameSince`,
`entrypoint`, `kind`, `status`, `statusUpdatedAt`, `updatedAt`, `startedAt`,
`version`, `hostSessionId`, `bridgeSessionId`, `messagingSocketPath`,
`peerProtocol`, `peerFeatures`, `pidDomain`.

- 37 files, 37 live pids. Entrypoints: 32 `claude-desktop`, 4 `t3-code`,
  1 `cli`.
- `ListAgents` returned 37 peers plus this session, and each row is
  `name [ref]`, status and start age. The name is the only send key.
- This file is the join the orchestrator did by hand. The #3172 lookup
  (ledger row, then `sessionId`, then a transcript's `custom-title.json`, then
  the title) is one read: the index maps `sessionId` to `name` directly, and
  says whether the process is alive.
- Names are not stable. This session's `nameSource` is `auto`, and T3 exposes
  `titleRegeneration` on threads. The capture's "priceless-aryabhata-e503c5"
  is a worktree-style name that never was a session title. A stored name is a
  hint; the stored key has to be `sessionId`.
- Desktop sessions carry `hostSessionId` (`local_<uuid>`) and some a
  `bridgeSessionId`. Neither is accepted by `SendMessage`.

### 3. Claude Code hosted by T3

This session's environment has `CLAUDE_CODE_ENTRYPOINT=t3-code`,
`CLAUDE_CODE_SESSION_ID` and `T3CODE_THREAD_ID=mcp:launch:78a27e42…`. The T3
tools report the same value as `currentThreadId`, and
`~/.t3/userdata/environment-id` holds the environment id (`17d7708d`). So a
T3-hosted session can read its complete T3 address from its own environment
and one file, with no tool call.

It is also a Claude peer: it appears in `~/.claude/sessions/` and in
`ListAgents` under its T3 thread title. It has two routes.

`t3_thread_read` on this thread returns `branch: explore/session-addressing`
and `worktreePath` for the T3-created worktree. `t3_thread_list` rows do not
carry either field.

### 4 and 5. T3 threads on every linked environment

`t3_environment_links` listed five links, all `reachable`, all `full-access`,
at probe time: beep-worker, dankserver, grok-bot VM, tbk-worker, tom-pc-1-wsl.

| Environment | Threads (`total`, all projects, children included) | Notes from the first page |
| --- | --- | --- |
| DankStation | 990 | `OPERATOR` thread, MCP-launched threads, `thread:subagent:*` children |
| beep-worker | 31 | children of a `delegated-task` thread |
| dankserver | 12 | provider-native children of one parent thread |
| tbk-worker | 18 | one user thread with a linked PR, one Codex `delegated-task` child |
| tom-pc-1-wsl | 2 | link receipts only |
| grok-bot VM | 2 | link receipts only; reachable at probe, asleep at other times per the capture |

Thread id shapes seen: a bare uuid (created in the web UI), `mcp:launch:<hex>`
(created by `t3_thread_launch`), `thread:subagent:<hex>`,
`thread:delegated-task:command%3Amcp%3A…` and
`thread:provider:<provider>:native-thread:…`. They are opaque strings; the
longest is over 300 characters.

Each row carries `providerInstanceId` (`claudeAgent`, `codex`), `model`,
`status`, `parentThreadId`, `relationshipToParent` and `pullRequests[]` with
`repository`, `number` and `state`.

T3 already indexes PR ownership for its own threads:

- The tbk-worker thread `d1a9ae3b` ("Optimize CI for Applicable Changes")
  lists PR #3195 in `pullRequests[]` and reports `pullRequestCount: 5`.
- `t3_thread_search "3122"` against tbk-worker returned that same thread.
  That is the owner the capture says had "no route": it had no ledger row on
  DankStation because it never ran on DankStation, and it was one search away
  on the right environment.
- `t3_thread_search "feat/outbox-draft-basis-check"` on DankStation returned
  nothing, correctly: #3172's owner is a Desktop session, not a T3 thread.

So T3 answers "which thread owns this PR" per environment, when the thread
linked its PR, and only if the caller searches each environment in turn.

### 6. Agent-tool and Workflow children

`SendMessage`'s own contract says cross-session messages travel between
sessions and a subagent's send goes out under its parent's address. A child
has no address. Its route is its parent's.

### 7. Codex outside T3

`~/.codex/state_5.sqlite` has a `threads` table with `id`, `cwd`,
`git_branch`, `git_sha`, `git_origin_url`, `title`, `name`, `source`,
`originator`, `archived`, `agent_nickname`, `agent_path` and
`attached_thread_parent_id`.

- All 64 live `codex` ledger rows resolve in that table by `sessionId`
  (the ledger stores `CODEX_THREAD_ID`).
- Originators in the last seven days: 2,519 `codex_exec`, 32 `T3 Code`,
  23 `codex-tui`, 14 `codex_work_desktop`, 3 `air-plugin:webstorm`,
  1 `Codex Desktop`. Subagent threads record their parent in `source`.
- A Codex thread whose originator is `T3 Code` is also a T3 thread, but I
  found no field on either side that maps the Codex id to the T3 `threadId`.
  NOT FOUND.
- I found no interface that delivers a message to a live Codex desktop or TUI
  thread from another process. `codex exec resume <id>` starts a new turn and
  is refused while the thread is live (recorded on this workstation earlier).
  `~/.codex/app-server-control/app-server-control.sock` exists; I did not
  probe it.

Codex outside T3 is fully discoverable (thread by branch or cwd) and not
messageable.

### 11. Remote hosts

The session ledger is a file under `~/.local/state/beep/sessions/` on each
workstation. A lane that runs on tbk-worker writes its row on tbk-worker.
Nothing copies rows between hosts, so from DankStation a remote lane is
visible only as a T3 thread. I did not inspect any remote disk.

## Session Ledger State (2026-11-12)

`~/.local/state/beep/sessions/github.com__beep-effect__beep-effect.jsonl`:
6,266 rows over 1,326 checkouts.

- 128 checkouts have a newest row that is not `done`.
- 74 of those rows are more than seven days old. 12 are under six hours old.
- The checkout directory still exists for 76 of the 128.
- Harness: 64 `codex`, 63 `claude-code`, 2 `unknown`. Two rows have no
  `sessionId`.
- 15 rows have a `sessionId` that is in the Claude live index with a live pid.
- #3172 has one row (lane `outbox-draft-basis`, harness `claude-code`,
  state `blocked`). #3171, #3122 and #3195 have none.
- Only 3 live rows sit under `~/.t3/worktrees`. Most T3 threads work from an
  ordinary clone or worktree, so the checkout path does not reveal the thread.

The "open" list is mostly dead rows. Nothing in a row says whether its session
still exists, and `session open` prints them all alike.

## In-Repo Capability Inventory

| Brick | Path | What it gives | Gap for addressing |
| --- | --- | --- | --- |
| `SessionLedgerRow` | `packages/tooling/tool/cli/src/commands/Session/Session.schemas.ts` | `repository`, `clone`, `checkout`, `lane`, `branch`, `pr`, `harness`, `sessionId`, `state`, `role` | no host, no route, no liveness |
| Harness identity | `Session/SessionLedger.service.ts` (lines 300 to 323) | reads `CLAUDE_CODE_SESSION_ID`, then `CODEX_THREAD_ID` | never reads `T3CODE_THREAD_ID`; `rg` for it across the CLI returns nothing |
| `openSessionRows`, `sessionOrchestrator` | `Session/Session.schemas.ts` | newest row per checkout; orchestrator by role | keyed by checkout only; no lookup by PR, branch or lane |
| `PrSessionRecord`, `ProvenanceSessionEvidence` | `Yeet/internal/Provenance.ts` | already captures `sessionName`, `nameSource`, `entrypoint`, `hostSessionId`, `sessionHome` from transcript and live-index evidence | `PrProvenanceEntrypoint` has no `t3-code` literal, so every T3-hosted Claude session decodes as `unknown` |
| `PrProvenanceHarness` | `Yeet/internal/Provenance.ts` | `claude-code`, `codex`, `unknown` | no Cursor, Grok or Junie |
| `RegisterRow` | `Session/Register.schemas.ts` | orchestrator register: `kind`, free-text `address`, `owns`, `state` (`active`, `blocked`, `unreachable`, `retired`), `orphanPlan` | `address` is `S.NonEmptyString` (the doc example is `"PR #1468"`); hand-kept by the orchestrator |
| SessionStart hook | `.claude/hooks/session-ledger.sh`; `.codex/hooks.json` | prints `session open` at session start | reads only; writes nothing |
| `WorktreeSessionMarker`, `sessionRootOf` | `Worktree/Worktree.schemas.ts`, `internal/repo-run/ProcessAttachment.ts` | proves a process belongs to a live Claude session through `CLAUDE_PID` | not used for message liveness |
| Yeet monitor inbox | yeet skill, `references/monitor-and-inbox.md`; `.claude/hooks/yeet-inbox.sh` | PR review comments reach the owning checkout's inbox | works only while the owner runs a monitor |
| T3 CLI | `~/.t3/bin/t3 thread list|show|send|start`, `t3 environment list` | thread data without MCP, `--json` | `thread list` takes a project only, no environment flag |

NOT FOUND in the repo: a route type, any PR or branch to session lookup, any
liveness check for a ledger row, any cross-host view of ledger rows.

T3's MCP server is registered at user level for Claude Code, Codex, Cursor,
Grok and Junie on DankStation (`~/.claude.json`, `~/.codex/config.toml`,
`~/.cursor/mcp.json`, `~/.grok/config.toml`, `~/.junie/mcp/mcp.json`). Every
harness can send to a T3 thread. Only T3 threads and same-host Claude sessions
can receive.

## Constraints Discovered

1. **The missing piece is a join, not a new store.** Ledger (checkout, branch,
   PR to `sessionId`), Claude live index (`sessionId` to name, pid, status),
   T3 (thread to branch, worktree, PRs) and the Codex thread table (id to
   branch, cwd) already hold the keys. The one fact captured nowhere is the T3
   address of a session working outside a T3-made worktree, and the session
   can read that from its own environment.
2. **Store ids, resolve names late.** Display names change. `SendMessage`
   needs the current name, so the resolver looks it up in the live index at
   send time.
3. **Inbound reach exists for two kinds only.** T3 threads (any environment)
   and same-host Claude peers. Everything else is discoverable at best. Making
   a Codex desktop, Cursor, Grok or Junie session receive would need a polling
   mailbox or a relay, which AGENTS.md rules out.
4. **A T3 thread is a durable address; a Claude peer is not.** A send to an
   idle T3 thread starts it. A Claude peer exists only while its process runs.
5. **The ledger is per host.** Cross-host ownership has two shared stores
   today: T3's `pullRequests[]`, searched one environment at a time, and the
   PR on GitHub.
6. **Ledger rows do not age out.** 58% of "open" rows are over a week old and
   41% point at a checkout that is gone. Liveness has to be computed at read
   time from the harness's own evidence.
7. **The CLI cannot call MCP tools.** A `beep` resolver can read the ledger,
   the Claude index, the Codex table and the local `t3` CLI. Searching other
   environments is an agent step through `t3_thread_search`.
8. **The repo is public.** Thread ids, environment ids and session names
   belong in workstation state, not in a PR body, unless the operator decides
   otherwise.
