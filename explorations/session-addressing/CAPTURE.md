# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-11-12

Brief from the orchestrator session (T3 thread `4d62216c`, environment
`17d7708d`), written at the operator's request. Filed as received, with home
paths shortened to `~`.

The question: how does any agent, given a PR, branch or lane, find the live
session that owns it and get a working message route to it, across every T3
environment and provider?

### The problem (observed 2026-11-12/13 by the orchestrator)

The operator has set up T3 Code's MCP across all providers and all linked T3
environments (DankStation plus beep-worker, dankserver, tbk-worker,
tom-pc-1-wsl and the grok-bot VM). The goal is that the orchestrator can
message every session. Sending messages mostly works now. Discovery is the
bottleneck.

- Sessions are addressed by display name: the Claude Desktop custom title or
  the T3 thread title. Nothing ties those names to the lane, branch or PR a
  session owns.
  - Example: the owner of #3172 (lane `outbox-draft-basis`, branch
    `feat/outbox-draft-basis-check`) was a Desktop session titled "Semantic
    agent graph stack review".
  - Finding it took several steps: the session-ledger row, then its
    `sessionId`, then `~/.claude/projects/<repo>/<sessionId>/custom-title.json`,
    then SendMessage by that title.
- The session ledger (`~/.local/state/beep/sessions/<repo>.jsonl`, written by
  `bun run beep session note`) records `sessionId`, `harness`, `checkout`,
  `lane`, `branch` and `pr`. It does not record a message address: no
  local-session name, no T3 thread id plus environment id, no Codex thread.
- Some owners had no route at all:
  - #3122 had no ledger row and no local worktree, so the orchestrator posted
    a PR comment instead;
  - #3171's owner was given to the orchestrator under a name that didn't
    resolve ("priceless-aryabhata-e503c5"), and only `ListAgents` found the
    real title;
  - Codex desktop and bare `codex exec` lanes started outside T3 are
    unreachable.
- Reach today:
  - Local Claude sessions on this host: SendMessage plus ListAgents.
  - T3 threads on any linked env: `t3_thread_list`, `t3_thread_send` and
    `t3_thread_search`, all taking an `environmentId`.
  - Remote non-T3 sessions are invisible.
  - grok-bot answers unreachable while it is asleep.

### What to produce

1. A census of every session kind (Claude Desktop, Claude Code CLI, T3 thread
   on each provider, Codex desktop and exec, Cursor, Grok, Junie, workflow and
   Agent children, remote hosts), with the address each one actually exposes
   and how to discover it. Proof from this machine and the linked envs, no
   speculation.
2. A schema for a session's route (an `effect/Schema` tagged union keyed by
   route kind), and where it should live. Obvious candidate: the
   session-ledger row, with SessionStart hooks and Yeet stamping the route
   automatically.
3. Resolution: PR, branch, lane or checkout resolves to a ledger row and then
   to a route, including the ownership hand-off on takeover, and liveness.
4. Fallbacks when there is no route: PR comment, or launching a takeover
   thread.

### Hard constraints

- AGENTS.md law: "The repo ships no mailbox, relay or dispatcher of its own."
  This is addressing and discovery metadata, not a transport. Anything that
  needs a relay is flagged as an operator decision, not designed in.
- No secrets, tokens or absolute home paths in committed files.
- Host is CPU-constrained: package-scoped checks only.
- Direction-setting decisions go through `/grill-with-docs` before graduation.
