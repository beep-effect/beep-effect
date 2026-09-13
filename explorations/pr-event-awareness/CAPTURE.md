# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-09-12

### The spark (operator, verbatim, during the time-to-certainty C3 closeout)

> Who do we make agents such as yourself aware within seconds of when merge
> conflicts happen, new pr comments drop & CI jobs fail?

> I'm wondering if we used the claude `messaging` feature where the webhook
> triggers a CLIProxyAPI call to claude that sends the message over to the
> orchestration agent for a given PR using the beep resume type of strategy
> for identifying the originating agent. Then as messages hit your inbox for
> example you could just pop off sub-agents to begin fixes as they drop.

> great points. Not that I want to do this immediately but I think it's worth
> bootstrapping an exploration packet for.

### Evidence from the day that sparked it (PRs #1102, #1126, #1130, #1131)

- The operator was the notification path three times: "1102 is conflicted.",
  "PR comment on 1126", "conflicts on 1130". Each time the orchestrator
  learned of the event from a human, minutes to hours after GitHub knew.
- One push produced roughly twenty check events; three review threads landed
  on one head; two fix rounds were superseded before their boards settled;
  about half the reds were the same environment-only flake (the test-utils
  Vitest runtime watchdog case). Naive one-lane-per-event dispatch would have
  launched a dozen fixers into one working tree.
- The orchestrator session died twice that day (a forced restart and the
  session limit). Detached Codex lanes launched with `setsid nohup` survived;
  `run_in_background` lanes did not. Whatever owns "the PR's agent" has to
  survive the owner dying.
- The watchers that existed: `yeet monitor` (exits on the first red or when
  the board ends), a file Monitor on the publish log, the desktop ci-monitor
  bind. None of them wakes an idle session; the session learns at its next
  tool call, or when the operator types.
- `yeet monitor` reported "blocked on closeout-run" until `yeet closeout`
  wrote the head-bound artifact, and exits 1 on optional Vercel reds even at
  `merge-ready: yes`. Readiness and event delivery are separate problems.

### Orchestrator's first assessment (Fable, same session)

Sources: `issue_comment`, `pull_request_review`,
`pull_request_review_comment`, `check_run`, `workflow_job` webhooks, or ETag
polling every 10–15 s; conflicts come from `push` to main plus a re-query of
the PR's merge state, since GitHub recomputes mergeability lazily. Delivery:
a `beep yeet events` daemon appending `.beep/yeet/events/<pr>.jsonl`, a
Monitor tailing it, cross-session messages for sessions without a Monitor,
and P0 inbox rows for conflicts and red required checks. Schema first: a
`YeetPrEvent` tagged union before any transport.

Three pushbacks on the proposal:

1. **No model in the relay.** CLIProxyAPI is a model proxy; routing a JSON
   payload through it spends an LLM turn to move bytes. The desktop
   session-manager is a local MCP server, so a daemon can be a plain MCP
   client of it and call `send_message` directly. The model enters once, when
   the orchestrator receives the message and judges it.
2. **Owner lookup is the resume footer, with a dead-owner fallback.** The PR
   body already carries the public resume block, and the workstation registry
   maps a PR to session rows. The gap is the dead owner: reconstitute with
   `claude --resume` headless or a fresh orchestrator seeded from the
   footer, never a lost event.
3. **"Pop off sub-agents as they drop" needs a state machine, not a
   fan-out.** Events keyed by head SHA, coalesced per head over a short
   window, dropped for superseded heads, attributed before dispatch
   (environment-only reds get a rerun, not a lane), one Codex lane per
   actionable event, serialized per PR under the PR lease, results to files,
   Fable judges and pushes. Under the standing delegation rule the
   sub-agents are Codex `exec` lanes, not Fable subagents.

Order proposed: grill the three schemas (`PrEvent`, `PrInbox`, the dispatch
rules), then the deterministic relay with a polling fallback, then the inbox
state machine on the orchestrator side, then webhooks.

### Second pass: what the live checkout already has (verified 2026-09-12)

Most of the relay exists under ship-velocity A1–A4 (completed-retained goal
packet, `goals/ship-velocity`). Paths under
`packages/tooling/tool/cli/src/commands/Yeet/internal/`:

- `WatchStream.ts` — `YeetWatchEvent`, a typed transition union already:
  `watch-started`, `check-transition`, `thread-transition`,
  `mergeability-changed`, `merge-ready-criterion-changed`, `head-changed`,
  `comment-posted`, `watch-ended`. Pure differ over consecutive snapshots;
  GitHub's open-ended check buckets totalized into pass/fail/pending/skip.
  This is the `PrEvent` schema the first assessment wanted to invent.
- `WatchMode.ts` — `runYeetWatchStream` polls at 10 s, emits one NDJSON row
  per transition on stdout, converges the checkout inbox after every poll.
- `Remediation.ts` — the wave record at `.beep/inbox/dispatch.json`: first
  red for a head opens the wave's repair session, later reds queue onto it,
  a new push supersedes the wave. Pure policy over persisted state. Explicitly
  leaves "attach a live harness to the session" to A2 hooks and A4 leases.
- `Inbox.ts` — `YeetInboxRow` union: `check-failed`, `sibling-collision`,
  `review-thread`, `base-drift`, `local-shard-failed`; deterministic ids;
  severity tiers.
- `MonitorComments.ts` — REST comment polling with per-collection
  watermarks (issue + review cursors).
- `MonitorLoop.ts` — `--until-merged` merge loop with flake fingerprints and
  exactly one rerun per job per head SHA; shape fingerprints before log
  fingerprints. This is "attribute before dispatch" for checks.
- `PrSessionRegistry.ts` + `Resume.ts` — append-only workstation registry
  (PR → session rows, local-only), `HarnessResumer` service, live Claude
  session matching by pid/session id/cwd, resume command construction.
  This is the "beep resume strategy" for owner lookup.
- `ProvenanceFooter.ts` — the public PR footer with concurrent-edit
  reconcile; number-only resume block by CSF-007.
- `.claude/hooks/yeet-inbox.sh` — the A2 delivery: reads the inbox at tool
  boundaries, P0 rows deny tools until acked with an attributed form; the
  Stop gate (A3) blocks ending a session with unacknowledged P0 work.

Outside the repo: `gh webhook forward` is an official extension (not
installed on this box); the desktop app exposes `bind_pr` / `set_monitor`
and a session-manager `send_message` that reaches an idle session.

### Reframed gap

1. **Push source.** The floor today is the 10 s watch poll plus GitHub's own
   check-registration lag. Webhooks or ETag polling buy seconds; only worth
   it for comments and conflicts, since a hosted board takes 15–25 min and
   the first red already opens the wave.
2. **Idle wake.** Hooks fire at tool boundaries. An orchestrator waiting on
   the operator, or sleeping in a Monitor, acts on nothing until it moves.
   The cross-session message is the only idle-wake primitive on the box; it
   is deterministic and needs no model in the loop.
3. **Lane dispatch.** The wave record coalesces checks per head but has no
   policy for threads or conflicts, and no lane launcher. The operator's
   "pop off sub-agents" is a dispatch policy on top of the wave record:
   Codex lanes, one per actionable capsule, serialized per PR, detached so
   they survive the owner.
4. **Dead owner.** `yeet resume` and A4 takeover exist; the wake path needs
   to fall through to them instead of dropping the event.

### Contradictions and threads to grill later

- Seconds versus the board: is sub-10 s worth a webhook receiver when the
  hosted suite takes 15–25 min? Comments and conflicts say yes; check reds
  beyond the first say no.
- Webhooks need repo admin and either a public receiver or `gh webhook
  forward` per operator machine; the 10 s poll already exists and needs
  neither.
- Wake the owning session, or spawn a fresh headless fixer (A4 warm fixer)
  and only tell the owner? The owner holds the judgment; the fixer holds the
  keyboard.
- A wake that lands P0 rows also arms the Stop gate; acks must stay
  attributed forms, never blanket.
- Standing rule: heavy fan-out goes to Codex lanes to preserve the Fable
  quota; Fable stays the judge.
- CLIProxyAPI's real role, if any: none in the relay; possibly the model for
  a headless fixer lane.
