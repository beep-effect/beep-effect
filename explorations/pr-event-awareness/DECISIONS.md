# Decisions

<!--
Stage 2. Grilling log for the align stage: one dated entry per settled
question, recommended answer first, rejected options recorded so a later
session does not re-argue them. `ops/manifest.json` `openQuestions` mirrors
the remaining frontier. Deferred questions are logged DEFERRED with a reason.
-->

## 2026-09-24 — align round 1

Frontier: the five questions with no open prerequisite. Source for every
figure below is [`RESEARCH.md`](./RESEARCH.md) (2026-09-24).

### D1 — Scope: what this packet adds over the desktop `set_monitor auto_fix` switch

- **Question.** The desktop app already wakes a bound session on CI failures,
  merge conflicts and review comments. What does this packet add, and is it
  enough to build anything?
- **Answer.** Yeet-side durable capture and attribution. The checkout inbox
  stays the durable record; the desktop switch becomes one wake vector among
  several, not the design.
- **Rationale.** The switch is app-only, session-scoped, undocumented, and
  dies with the session. It has no flake attribution and no per-head
  coalescing, and it does nothing for terminal or proxy sessions or for
  detached lanes. Every hook already reads the inbox, so rows are the
  contract that survives an owner's death.
- **Rejected.** Terminal parity only (reproduces the switch's blind spots).
  Park the packet (the canonical babysit recipe keeps losing bad news). The
  full original vision (a receiver buys about 8 s median against boards of
  40-55 minutes, and is moot until a producer exists).

### D2 — Producer: `yeet monitor --until-ready` gains the watch's convergence

- **Question.** Which mode owns durable delivery of bad news? The canonical
  recipe writes only `pr-merge-ready`; only `--watch` runs the convergence
  that writes `check-failed`, `review-thread` and `base-drift` rows, and it
  has never been run detached.
- **Answer.** Extend `--until-ready` so every poll runs the watch's
  convergence (`convergeYeetWatchDispatch`, `WatchMode.ts:595-656`) and
  writes those rows; `--watch` stays the 10 s streaming mode for attended use.
- **Rationale.** One recipe keeps its ready terminal and automatic closeout.
  A 30 s cadence is adequate for a durable record (about 20 s expected event
  to row). The writer already exists; the change is wiring, not a new
  subsystem.
- **Rejected.** Make `--watch --detach` canonical (two recipes diverge; no
  ready terminal, no automatic closeout). A new unified mode (largest surface:
  a new route plus tests for both halves).

### D3 — Forward both harness session ids through the proof-job env allowlist

- **Question.** 163 of 803 session-registry rows are unresumable, 100 of them
  written by detached monitors, because the proof-job env allowlist
  (`ProofJob.ts:146-165`) admits neither `CLAUDE_CODE_SESSION_ID` nor
  `CODEX_THREAD_ID`. Forward both?
- **Answer.** Yes, forward both names through the allowlist.
- **Rationale.** A session id names a local transcript, not a credential;
  attended runs already write it to the local registry, and the public footer
  projection (CSF-007) keeps it off GitHub regardless. Two allowlist names
  make detached monitors resumable.
- **Rejected.** A dedicated `--session` flag or `BEEP_`-prefixed variable
  (same outcome, more surface). Keep the allowlist closed and accept
  unresumable monitored rows.

### D4 — Pay the measurement debt first: check timestamps and hook first-seen stamps

- **Question.** Neither `gh pr checks --json` call site requests
  `completedAt`/`startedAt`, and hook session files carry no timestamp, so
  event-to-row and row-to-delivery cannot be measured from artifacts. Pay the
  debt, and when?
- **Answer.** Both, as the first slice: request `completedAt`/`startedAt` at
  `WatchMode.ts:232` and `Status.ts:868`, carry them into rows, and stamp a
  first-seen time per `seenId` in the hook's session files.
- **Rationale.** Every later decision argues about latency; without these
  fields it stays inferred. The change is tiny and makes the producer slice
  provable.
- **Rejected.** Only the check timestamps (row-to-delivery stays conflated
  with row-to-ack). Defer until after the producer ships (the first slice
  would ship unprovable).

### D5 — Ack pruning is a separate small PR, outside this packet

- **Question.** The inbox hook spawns two `jq` processes per ack receipt
  inside a 2 s budget; receipts grow with no pruning, so delivery fails
  silently in roughly 73-164 days. In scope?
- **Answer.** No. Fix it now in its own small PR (prune receipts whose rows
  are gone, or scan receipts in one `jq` pass) and record it as a
  ship-velocity opportunity.
- **Rationale.** It is a hook-budget bug independent of event capture; keeping
  it out keeps this packet's slices about events.
- **Rejected.** Fold into the first slice (widens it). Defer until it bites
  (the failure is silent: no rows injected, the P0 gate stops arming).

## 2026-09-24 — align round 2, page 1

Frontier unblocked by D1 and D2: the conflict terminal, the wave record, and
delivery scope.

### D6 — Conflicts: a `base-conflict` row (P0), keep polling, no new terminal

- **Question.** What terminates a conflicted PR? A `base-conflict` settle
  verdict is a named unbounded wait (`Settle.ts:943`, `budgetApplies: false`),
  no conflict row kind exists, and `base-drift` fires only on `BEHIND`
  (`WatchMode.ts:634`), so a conflict never reaches the inbox.
- **Answer.** Add a `base-conflict` inbox row kind, P0 per head, produced by
  the extended `--until-ready` convergence and cleared when a later head is
  mergeable. The loop keeps waiting; no new terminal reason.
- **Rationale.** The row is what wakes and dispatches. A terminal would end the
  detached monitor exactly when the fix lands and the new head needs
  observation.
- **Rejected.** A `conflict` terminal with exit 1 (scripts get a return, but
  the monitor must be relaunched after every fix). A row only on
  settle-timeout (ruling 49 narrowed the budget to registration waits, so a
  conflict would rarely trip it).

### D7 — Wave record: extend to conflicts, key by head SHA, threads survive supersede

- **Question.** `dispatch.json` coalesces check reds per head and is re-pinned
  only by the watch stream (`WatchMode.ts:822`, `:1009`); `review-thread` and
  `base-drift` rows bypass it, and a 15-day stale pin silently dropped 11 of
  13 `check-failed` rows in this checkout. Extend it, and on which key?
- **Answer.** The wave covers check reds and conflicts per head and
  `--until-ready` re-pins it on every poll. A new push supersedes reds and
  conflicts but not unresolved review threads. The key stays the head SHA.
- **Rationale.** GitHub resolves a thread by conversation, not by a push, so
  superseding threads would lose review work. Head SHA is the identity every
  row already carries.
- **Rejected.** Key by patch-id (a second identity per row, pays off only for
  rebase-only pushes). Keep the wave checks-only (rows land uncoalesced, the
  stale-pin drop stays).

### D8 — Delivery scope: same checkout is the contract

- **Question.** Rows land only in the checkout that ran the monitor (64
  inboxes on this box). Where should rows be delivered?
- **Answer.** Producer and reader share one inbox: the babysit recipe runs in
  the lane the orchestrator owns. Document the contract; no cross-checkout
  write path; `sibling-collision` stays without a producer.
- **Rationale.** Matches the AGENTS.md closeout rule that the lane runs its own
  CLI, and avoids a write path the worktree fence would have to admit.
- **Rejected.** A registry-driven target for the monitor's rows (a monitor
  could run anywhere, at the cost of a cross-checkout write). A
  workstation-level inbox under XDG state (changes the hook contract every
  clone relies on).

## 2026-09-24 — align round 2, page 2

### D9 — Push source: keep the poll; a receiver is a MAP gate

- **Question.** Keep the poll or stand up a receiver? A webhook reaches a
  receiver in a median 2.08 s; the extended `--until-ready` poll gives about
  20 s expected event to row; verified boards take 40-55 minutes push to
  ready; no workstation consumer of any AWS push transport exists.
- **Answer.** Keep the poll. Collapse the watch snapshot from ten GraphQL
  requests to one combined query (measured cost 1) as the cheap win. Record
  the receiver in `MAP.md` as a gated candidate that fires when the
  measurement slice (D4) shows event-to-row is what hurts.
- **Rationale.** With a producer, the cadence is not the bottleneck; a
  receiver buys about 8 s median per event against boards measured in tens of
  minutes, and both receiver shapes carry a live-CI or new-stack cost.
- **Rejected.** A second receiver on the `CiTurboCache` shape (net-new stack,
  second secret, no GitHub Pulumi provider, no workstation consumer). Flipping
  the CI autoscaler's `eventbridge` input (a CI-availability decision owned by
  ci-fleet-endgame). `gh webhook forward` per workstation (documented for
  testing only; leaves a hook behind).

### D10 — Wake: the monitor sends a cross-session message to the registry owner

- **Question.** Which idle-wake mechanism delivers a new P0/P1 row to the
  owning session, and must it work in proxy sessions?
- **Answer.** When the extended `--until-ready` writes a P0/P1 row, it looks
  up the owning session in the PR session registry (resumable after D3) and
  sends one cross-session message over the harness messaging socket, one per
  wave rather than per row. Where the PR is bound in the desktop app,
  `set_monitor auto_fix` stays on as a second vector. Proxy-session
  (`claudex`/`claudeg`) support is the first thing the slice tests.
- **Rationale.** Deterministic, no model in the relay, and it works in
  terminal sessions. Harness cross-session messages start a turn on an idle
  receiver and drain at the next tool round when it is busy; the socket and
  token variables are present in the research session.
- **Rejected.** `asyncRewake` exit 2 only (ruling 46's spike is unwired, has no
  injection before the first tool call, and cannot interrupt an in-flight
  call). Desktop switch only (no terminal parity; contradicts D1). Human
  escalation only (keeps the operator as the notification path).

## 2026-09-24 — align round 3, page 1

Frontier unblocked by D10 (wake) and exposed by D2/D9: dead-owner
fallthrough, poll cadence, top-level comment rows.

### D11 — Dead owner: escalate to the human with the resume command; takeover stays a MAP gate

- **Question.** When the wake message finds no live owner in the PR session
  registry (4 of 59 recorded Claude session ids were live at read time), what
  happens? Operator PR #921 retired automatic takeover; `--resume`,
  `--continue` and `--fork` all start a new process from a transcript.
- **Answer.** The monitor fires the existing sequence-break notifier (desktop
  notification, ntfy escalation) carrying `yeet resume <pr>` and the wave
  summary; nothing is spawned. The row stays in the inbox for whoever
  resumes. Automatic takeover is recorded in `MAP.md` as a gated candidate.
- **Rationale.** Respects the #921 fence and reuses a brick that exists; the
  event is not lost, only its handling waits for a human.
- **Rejected.** Automatic headless resume of the dead owner (reverses #921,
  runs unattended in the old permission mode, stale context). A fresh
  footer-seeded orchestrator (same reversal plus a cold context). A warm fixer
  lane (largest reversal; judgment leaves the owner).

### D12 — Cadence: keep 30 s; revisit with the measurement slice

- **Question.** Poll cadence for the extended `--until-ready`. The chain is
  about 5 s of real work per poll (median 4.9 s, p90 11.5 s), so 10 s would
  run at about 50% duty and triple API load; 30 s gives about 20 s expected
  event to row, about 42 s worst.
- **Answer.** Keep 30 s. D4 makes event-to-row visible, so any later change is
  evidence-driven.
- **Rationale.** A durable record twenty seconds behind GitHub is fine when a
  fix takes minutes and a board takes tens of minutes; zero new API load.
- **Rejected.** Adaptive cadence (10 s on a fresh head with pending required
  checks; a second regime to test). 10 s everywhere (triples calls per PR and
  presses the GraphQL budget across detached monitors).

### D13 — Comment rows: P1 `pr-comment` for human, non-self top-level comments

- **Question.** Do top-level PR comments (issue comments, not review threads)
  get an inbox row kind? Only unresolved review threads produce
  `review-thread` rows today; a plain comment is a watch-only stdout event,
  and bots post most top-level comments.
- **Answer.** Yes: one P1 `pr-comment` row per top-level comment from a human
  account that is not the publishing identity, coalesced into the wave,
  never superseded by a push (a comment is answered, not outdated), cleared
  by an attributed ack. Bot authors are filtered by the existing review-body
  signal rules.
- **Rationale.** The spark's "PR comment on 1126" case is this row; the watch
  already polls the comment collections with watermarks.
- **Rejected.** Only mention or directive comments (a plain "please rebase"
  would be missed). Review threads only (the comment case stays unaddressed).

## 2026-09-24 — align round 3, page 2

### D14 — Dispatch: the woken orchestrator dispatches; Yeet supplies rows and the wave

- **Question.** Who launches fixers when a wave lands? The capture's "pop off
  sub-agents as they drop" predates the Opus-only sub-agent directive, and
  Yeet already performs the one mechanical remediation automatically (one
  flake rerun per job per head).
- **Answer.** Yeet's job ends at an attributed, per-head-coalesced wave
  delivered to the owner. The owner judges and spawns sub-agents per capsule
  under the standing directive. No auto-launcher.
- **Rationale.** Keeps judgment in the session, adds no launcher, and is
  consistent with D11 and the operator PR #921 fence.
- **Rejected.** Yeet auto-launching a detached fixer lane per capsule (a
  net-new launcher, a headless fixer with its own permission story, a partial
  reversal of #921). A hybrid where Yeet also runs `yeet repair` for
  lint-class reds in the lane (a repair and the owner editing the same lane
  need the hook mutex to arbitrate).

## 2026-09-24 — align round 3, page 3

### D15 — Wake sender: a session-owned inbox tail spawned by the SessionStart hook

- **Question.** Who posts the wake message? A bypass-permissions receiver
  holds every message unless the sender also bypasses or is verified as the
  session's own child process (a hook or Bash command posting to its own
  session's socket; on Linux verified by process evidence even after the child
  exits); a held dialog expires after 5 minutes and drops the message;
  `crossSessionInbound: accept` can be set only in user, managed or
  `--settings`; the fleet runs long-lived bypass sessions; the detached monitor
  is a systemd unit, not the session's child, and does not know the receiver's
  socket (`explorations/fleet-coordination/research/T6-cross-session-messaging.md`
  §5; `RESEARCH.md` §4).
- **Answer.** The already-wired SessionStart hook spawns a small child that
  watches the checkout inbox (D8: same checkout as the monitor) and posts one
  message per new P0/P1 wave into its own session's socket. Own-child
  provenance means delivery even in bypass mode; the child inherits the socket
  and token and exits when the session's process is gone. The monitor only
  writes rows.
- **Amends D10.** The monitor no longer needs the registry to find the owner;
  the registry serves D11's is-anyone-live check and `yeet resume`.
- **Rationale.** Delivery outcome is a property of the receiving session's
  permission mode, which an external sender cannot see or control; a sender
  inside the session's own process tree is the one path the harness delivers
  unconditionally.
- **Rejected.** The monitor posting directly with sessions opting in via
  `crossSessionInbound: accept` (needs the socket path in the registry, a
  user-level settings change per workstation, and opens each session to any
  local sender). The monitor posting directly and accepting the hold (bypass
  sessions drop the wake after 5 minutes). A channel MCP server per session
  (needs claude.ai or Console auth, untested in proxy sessions, a new server
  per session).

## Align complete (2026-09-24)

Frontier empty after three rounds (5 + 5 + 5 questions through
AskUserQuestion, recommended answer first; every recommendation was accepted).
The design tree, root to leaf:

- **Scope (D1):** Yeet-side durable capture and attribution; the desktop
  `set_monitor auto_fix` switch is one wake vector, not the design.
- **Producer (D2, D6, D7, D12, D13):** `yeet monitor --until-ready` runs the
  watch's convergence every 30 s and writes `check-failed`, `review-thread`,
  `base-drift`, a new P0 `base-conflict` row, and a new P1 `pr-comment` row
  for human non-self top-level comments. The wave record covers reds and
  conflicts per head SHA, is re-pinned by `--until-ready`, and lets unresolved
  threads and comments survive a push. No new loop terminal.
- **Delivery (D8, D10, D15):** producer and reader share one checkout inbox;
  a SessionStart-spawned, session-owned tail posts one cross-session message
  per new wave into its own session; the desktop switch stays on where a PR
  is bound. Proxy-session support is the first thing the slice tests.
- **No owner (D11):** human escalation through the sequence-break notifier
  with `yeet resume <pr>`; automatic takeover is a MAP gate, not a build.
- **Fixing (D14):** the woken orchestrator dispatches sub-agents; Yeet adds no
  launcher beyond the existing flake rerun.
- **Push source (D9):** keep the poll; collapse the watch snapshot to one
  GraphQL query; a webhook receiver is a MAP gate.
- **Owner attribution (D3):** forward `CLAUDE_CODE_SESSION_ID` and
  `CODEX_THREAD_ID` through the proof-job env allowlist.
- **First slice (D4):** measurement debt first: check `completedAt`/`startedAt`
  in both snapshot sites and first-seen stamps in hook session files.
- **Outside the packet (D5):** ack-directory pruning ships as its own small PR.

Assumptions carried into shape without a question, because they have a
conventional default: the wake message body is a pointer plus a one-line
attributed summary of the wave (the hook injects the rows themselves at the
next boundary); one tail per session, idle on inotify; row severities follow
the existing table with `base-conflict` at P0 and `pr-comment` at P1.



## 2026-09-25 — grill-with-docs round 4 (doctrine, code and cross-packet audit)

Source: a read-only three-audit Workflow (doctrine surfaces, code
cross-reference, sibling packets), each report verified span by span by a
skeptic (all Opus 5; run `wf_1e14b982-94d`, 2026-09-24/25, resumed after a
workstation restart). Thirty-seven findings, none unsupported; twelve needed
the operator (three AskUserQuestion rounds, recommended answer first, every
recommendation accepted) and the rest are locked from the repo below. Line
cites are as verified on 2026-09-25.

### D16 — Loop contract: reds and conflicts stop being terminal under `--until-ready`; `job wait` returns on a wave

- **Amends D2, D6, D7; amends ttc ruling 42.**
- **Question.** `--until-ready` already exits on `required-red`
  (`MonitorPolicy.ts:202-211`, `MonitorLoop.ts:1442-1450`; ttc ruling 42's
  exit table), so D2's convergence would write one wave and the monitor would
  die — the failure D6 rejected for conflicts. D7's per-poll re-pin and D15's
  mid-flight wake cannot span a fix push. Which loop contract does the
  producer get?
- **Answer.** Under `--until-ready`, a required red and a base conflict are
  no longer terminal: the monitor keeps polling across heads and re-pins the
  wave per head. `yeet job wait` gains a second return — a distinct exit code
  the moment a new P0/P1 wave lands on the job's PR — so the blocking closeout
  recipe still hands control back; after the fix push the orchestrator re-runs
  `job wait` on the same job. Exit 0 stays `ready`; `merged`, `closed`,
  `settle-timeout` and `poll-error-budget` stay terminal.
- **Rationale.** Durable capture needs a producer that outlives the first
  red; a wave return on `job wait` keeps the attended recipe blocking-shaped
  while D15 covers the idle case. Moving to `--until-merged` is already
  rejected by ruling 42 (no exit-0 terminal to block on), and re-arming after
  every exit 1 is today's recipe (`.claude/skills/yeet/SKILL.md:496-497`) —
  the one the packet exists to fix.
- **Rejected.** Keep `required-red` terminal and re-arm per fix (rows
  durable, wave re-pinned only while a monitor is alive). Move the producer
  to `--until-merged` (no exit-0 `ready`; the recipe becomes wake-driven).
- **Records.** `AGENTS.md:144-153` (closeout bullet) and `SKILL.md:491-497`
  (exit-1/re-arm text) change with the producer slice; ttc ruling 42 carries
  a proposed amendment naming the exit-table change (D25).

### D17 — `base-conflict` stays P0; the monitor writes a `cleared` ack when the same head turns mergeable

- **Amends D6.**
- **Question.** A P0 row arms the Stop hard gate (`yeet-inbox.sh:301-303`;
  the hook keeps `unknown`-liveness rows, `:142`, `:149`), so a
  `base-conflict` row blocks every turn end until a new head supersedes it or
  an attributed ack lands. A conflict can also clear at the same head (the
  other PR reverts; `DIRTY` → `MERGEABLE`) and nothing clears it then:
  liveness reads only `(headSha, prNumber)` (`yeet-inbox.sh:144`,
  `InboxView.ts:157-163`), never the wave's `capsuleIds`
  (`Remediation.ts:114`), and `--observed` acks pin liveness to `live` forever
  (`InboxView.ts:154`, `InboxPorcelain.ts:417`).
- **Answer.** P0 stands (the ship-velocity A3 can't-leave-the-scene rule).
  The producer writes a seventh `YeetAckResolutionKind`, `cleared`, attributed
  to the monitor job, when the same head is observed mergeable again; a new
  head still supersedes through the wave. The row kind reuses the
  `base-conflict` literal already in `YeetSettleReason`
  (`CheckOutcome.ts:86-92`) and says so: the settle wait clears by re-read,
  the row by wave supersede or `cleared`. `CheckOutcome.ts:63-64` ("clears
  when the operator merges the base and pushes") changes to the woken agent,
  with the producer slice.
- **Rationale.** The only same-head clear the code admits is an ack kind: a
  wave re-pin cannot supersede at the same head, and observed-kind membership
  pins liveness. Implemented at `MonitorLoop.ts:1198-1201`, where
  `yeetBaseConflictFor` already runs every poll, with a `conflictRow` twin of
  `announcedRow` (`:1373`) — no convergence and no new GitHub read, so D6
  ships independently of D23.
- **Rejected.** Downgrade to P1 (wakes, never gates; weaker than A3). Manual
  ack only (a session in a checkout with no monitor stays blocked until
  someone acks by hand). Clearing through the wave record (liveness ignores
  `capsuleIds`; a missing wave yields `unknown`, which the hook keeps).

### D18 — Dead-owner escalation is a new pr-wave notifier that reuses only the transport ladder

- **Amends D11.**
- **Question.** D11 said it reuses `sequence-break-notifier.sh`. It cannot:
  the worker exits 0 for any `target:waitReason` outside three
  PermissionRequest pairs (`:70-73`), needs a live hook-pulse bracket for the
  caller's session or goes silent after the first stage (`:697-702`,
  `:710-715`), and is content-free by contract (`:1-7`;
  `docs/runbooks/agent-notifications.md:3-4`, `:58-63`), so it may not carry
  `yeet resume <pr>` or a wave summary. What is the escalation?
- **Answer.** A sibling worker (a pr-wave notifier, hook-side or
  monitor-side) takes a wave descriptor, reuses the OSC 777 / notify-send /
  ntfy ladder, resolves on the row being acked instead of on a permission
  bracket, and writes its own ledger namespace. Content rule as a named
  exception: the local desktop/OSC body may carry `yeet resume <pr>` plus a
  one-line summary; ntfy and the evidence ledger stay generic.
  `sequence-break-notifier.sh` is untouched.
- **Rationale.** The notifier's arg wall and bracket-resolve rule are what
  the agent-effectiveness evidence ledger depends on; a second mode inside it
  would be a doctrine edit to that file. The ladder is the reusable part.
- **Rejected.** A `pr-event:<class>` wait class plus a synthetic bracket
  inside hook-pulse and the notifier (relaxes the content-free invariant).
  Desktop `set_monitor` only (terminal and proxy sessions get no human
  signal).

### D19 — Unknown liveness is dead: escalate, and record the Codex consequence

- **Amends D11.**
- **Question.** The only live-owner probe is Claude-only —
  `isClaudeSessionLive` returns none for any non-`claude-code` harness
  (`Resume.ts:239`), called once at `:518` against `$HOME/.claude/sessions`
  plus `/proc`. The Codex live guard is unshipped resume-footer PR-2 scope
  (`goals/yeet-pr-resume-footer/SPEC.md:27-28`), and D3 makes Codex
  attribution more common because `classifyHarness` prefers `CODEX_THREAD_ID`
  (`Provenance.ts:1301-1302`). How does D11 treat unknown liveness?
- **Answer.** Unknown is dead. Every Codex-attributed owner escalates to the
  human until the Codex live guard ships; D11 lists that guard as a later
  dependency, not a blocker. A detached monitor submitted from a codex-exec
  lane attributes as `codex` by design.
- **Rationale.** A false escalation costs one notification; a suppressed one
  costs the bad news the packet exists to deliver.
- **Rejected.** The Codex live guard as a prerequisite of the delivery slice
  (gates the slice on another packet). Unknown as live (Codex-owned PRs get
  rows and hook injection only).

### D20 — The delivery slice opens with a socket probe gate; the tail is a shell worker

- **Amends D15.**
- **Question.** The SessionStart registration has a 2 s timeout
  (`.claude/settings.json:210-215`), so the tail must detach. The in-repo
  precedent is `setsid -f` (`hook-pulse.sh:425`), which reparents to the
  `systemd --user` subreaper (verified on a live worker: ppid 1671, not the
  session pid), so the retire fence's ancestry test
  (`Worktree.service.ts:1289-1300`) fails for it, and whether harness
  own-child provenance survives is unmeasured (T6 §1,
  `T6-cross-session-messaging.md:68-71`). No repo-cli code watches a file; the
  one watcher precedent is `makeWaitForFile`
  (`packages/foundation/modeling/utils/src/FileSystem.ts:507-515`, `fs.watch`
  on a directory), and `fs.watch` inside a dotfile directory is unmeasured.
  The wire protocol is unspecified anywhere (six prose hits, zero code).
- **Answer.** No tail code until a live probe is on disk in `research/`: post
  to `$CLAUDE_CODE_MESSAGING_SOCKET` from (a) an in-hook child, (b) a plain
  background child, (c) a `setsid -f` child; record one accepted frame, one
  refusal, and which senders the harness delivers into a bypass session. A
  failed probe re-opens D15 (fallback: hook injection plus D18 escalation).
  The tail is a shell worker beside `yeet-inbox.sh` (`inotifywait` plus the
  hook's jq liveness), cwd outside the lane, one inotify fd, self-reap by
  polling the session pid's `/proc` start identity (`ProcessIdentity.ts:195`,
  `:299`, `:347`), teardown registered on the already-wired SessionEnd hook,
  and a retire-fence regression (`bun run beep yeet sweep --retire` succeeds
  with the tail running) in the slice's acceptance tests, ahead of
  proxy-session support.
- **Rationale.** The sender's contract is the load-bearing unknown; a probe
  costs an hour and a wrong guess costs the slice. A shell worker keeps the
  2 s SessionStart budget honest, avoids a resident bun process per session
  across 64 checkouts, reuses the hook's decode and liveness jq, and the wake
  body is a pointer plus a one-line summary anyway. The memory decision log's
  "per-session frontends with no reaping path" watch item
  (`standards/memory-architecture/04-decision-log.md:361-366`) is why the
  reap is specified now.
- **Rejected.** A `yeet inbox tail` subcommand on `makeWaitForFile` (typed
  decoding, but a bun process per session and a second probe for `fs.watch`
  on `.beep/inbox/`). Building first and letting acceptance tests find out.

### D21 — Comment cursor: per-consumer watermark; the first-cycle backlog becomes rows

- **Amends D13; re-prices D12.**
- **Question.** `pollUntilMerged` replays comments on cycle 1 only
  (`MonitorLoop.ts:1469-1471`) and `replayYeetMonitorComments` prints them,
  then advances and persists the watermark (`MonitorComments.ts:1559`;
  `monitor-comments.json`, `:490`). The path is
  `<artifactDir>/runs/<runId>/monitor-comments.json`
  (`ArtifactPaths.ts:303-311`) and `runId` derives from the branch alone
  (`:225-228`), so an attended `--watch` and a detached `--until-ready` on
  one branch share one cursor byte for byte, and a detached monitor's first
  cycle burns the backlog into a job log nobody reads.
- **Answer.** Namespace the watermark by consumer mode so the two loops
  cannot steal each other's comments, and in the `--until-ready` path convert
  the cycle-1 backlog into `pr-comment` rows instead of printing it. D12's
  30 s rationale is re-priced against about 7.5 s of per-poll work (the
  comment chain adds 1.5–2.7 s to the 4.9 s status chain; `RESEARCH.md:974`).
- **Rejected.** One documented comment consumer per checkout (collides with
  D8 when the operator opens an attended `--watch` in the lane). Accepting
  lost comments.

### D22 — One shared wave-exempt kit; `base-drift` keeps superseding on a push

- **Amends D7, D13; corrects RESEARCH.md finding 20.**
- **Question.** `YeetReviewThreadCapsule` and `YeetBaseDriftCapsule` carry
  `headSha` and `prNumber` (`Inbox.ts:315-317`, `:378-379`), so both readers
  already supersede them on a head mismatch — the CLI escapes four kinds by
  kind (`InboxView.ts:154`), the hook one kind plus a capsule-shape test
  (`yeet-inbox.sh:141-143`) — and `Inbox.ts` has exactly two `LiteralKit`s
  (`:98` severity, `:693` observed kinds), none for the row-kind set.
  "Threads survive a push" is a behaviour change in two hand-synced places.
- **Answer.** Add `YeetInboxWaveExemptRowKind = LiteralKit(["review-thread",
  "pr-comment"])` beside `YeetInboxObservedRowKind`; `yeetInboxRowLiveness`
  reads it instead of the inline chain; the hook carries the exempt-plus-
  observed union as one jq literal list, and a repo-cli test parses that
  literal out of `yeet-inbox.sh` and asserts it equals the kits (one kit
  cannot bind jq, so parity is a test, not a generation step). `base-drift`
  keeps superseding on a push: a push after merging the base is its fix, and
  the next poll re-emits if not. D7 now states that this changes existing
  `review-thread` behaviour.
- **Rejected.** `base-drift` in the exempt set (a stale drift row then needs
  its own clearing path). Two hand-synced lists plus a comment (the 4-vs-1
  kind mismatch between readers stays and widens).

### D23 — The measurement slice widens: four check fields, `YeetWatchCheck` in the status snapshot, `Converge.ts`

- **Amends D2, D4.**
- **Question.** The watch's capsule is built from `check.signal.bucket` and
  `.state`, `check.link` and `check.workflow` (`Remediation.ts:676-684`), but
  the merge loop's checks are `YeetSettleCheck { name, outcome, required }`
  (`Settle.ts:442-451`): `Status.ts:1314-1323` discards bucket and state and
  `Status.ts:868` never requests `link` or `workflow`. A `check-failed` row
  from `--until-ready` would carry empty bucket/state and null link/workflow,
  blanking the link the hook renders (`yeet-inbox.sh:177`).
  `convergeYeetWatchDispatch` is module-private (`WatchMode.ts:595`), takes a
  whole `YeetWatchSnapshot` and reads five fields plus `context.base` and
  `context.repoRoot`.
- **Answer.** `Status.ts:868` requests
  `name,state,bucket,link,workflow,completedAt,startedAt` (all accepted by
  `gh pr checks --json`, verified 2026-09-25); `GhStatusCheck` grows the four
  as `S.optionalKey`; `YeetStatusRemote.checks` becomes
  `S.Array(YeetWatchCheck)` through `SchemaUtils.withKeyDefaults` (the
  `labels` idiom, `Status.ts:253`), never `withConstructorDefault`, so the
  hand-written legacy snapshot in `test/yeet-status-triage.test.ts:861-869`
  still decodes (no production code decodes `status.json`; the only codec use
  is the encode at `Status.ts:1811`). The convergence moves to
  `internal/Converge.ts` with its signature narrowed to the fields it reads,
  imported by both `WatchMode` and `MonitorLoop` (acyclic: `MonitorLoop`'s
  only importer is `Porcelain.ts:36`), and `dispatchYeetCheckFailure`'s
  parameter narrows to `{ headSha, prNumber }`.
- **Rejected.** Timestamps only with degraded rows. Importing `WatchMode`
  into `MonitorLoop` and synthesising a watch snapshot (drags the watch stream
  and registration-patience machinery into the merge loop's import graph).

### D24 — The 30 s durable path trades the A1 latency bar; recorded, with c2 as prior art

- **Amends D12.**
- **Question.** Ship-velocity A1 recorded "<15 s p95 first-red to inbox" as
  met (`goals/ship-velocity/SPEC.md:43`; `PLAN.md:58-59`, measured on the
  10 s `--watch` tick). The `--until-ready` producer runs on the 30 s loop:
  about 20 s expected, 42 s typical worst, 84 s observed (`RESEARCH.md:999`).
  D12 rejected adaptive cadence although
  `goals/ship-velocity/research/c2-yeet-monitor-backpressure.md:425-429`
  already prescribes the split (10 s only on cheap required-check state).
- **Answer.** Accept the durable p95 of about 42 s and say so: a new path
  under an old bar, not a regression; `--watch` keeps 10 s. Ship-velocity
  `PLAN.md:58-59` is annotated that the 15 s figure is scoped to `--watch`.
  If the measurement slice argues for speed, it cites c2's split-lane design
  instead of re-deriving an adaptive regime.
- **Rejected.** A cheap required-check fast lane in the first slice (a second
  regime before the measurement slice has data). Recording nothing.

### D25 — Records: proposed ttc amendments now; this packet's goal owns the producer extension

- **Question.** Six ttc rulings are touched: 39 (D3's two allowlist names),
  42 (D16), 46 and 48 (their FileChanged/asyncRewake idle-wake spike is listed
  as shipped in `goals/time-to-certainty/PLAN.md:82-83` while
  `research/b7-implementation.md:671-672` says "not exercised"; D10/D15
  supersede it), and 41's heading clause ("the packet stays at capture" is
  stale; its scope clause limits B7, not this packet, so D9 and D14 do not
  breach it — `research/b7-design-tree.md:90-92`). Ship-velocity
  `SPEC.md:39-41` and `PLAN.md:60-61` still describe the spawn D14 retires.
- **Answer.** Recorded now, as proposed amendments in the ttc log's own form
  ("proposed by the orchestrator, ratified by merge of the PR"), inline under
  rulings 39, 41, 42, 46 and 48 with a round-22 index entry; ttc `PLAN.md`'s
  B7 line marks the idle-wake spike not exercised and superseded;
  ship-velocity `SPEC.md:39-41` and `PLAN.md:58-61` are annotated. Going
  forward this packet's graduated goal owns the `--until-ready` producer
  extension; the ttc log stays the place its settle rulings are reachable
  from. Law text whose truth depends on code ships with the producer slice:
  `AGENTS.md:144-153`, the yeet skill's wave and exit-1/re-arm text
  (`SKILL.md:202-211`, `:491-497`), `CheckOutcome.ts:63-64` and
  `Remediation.ts:14-18` JSDoc. The operator registers any
  `.claude/settings.json` hook change (agent `Edit` is denied at `:85`); the
  producer PR names that step.
- **Rejected.** Landing D2/D6/D7/D12/D13 as a ttc B7 follow-up item (two
  packets owning one command's behaviour). Deferring every cross-packet
  record to the producer PR (stale boundaries meanwhile).

### D26 — The socket sender is hook-side shell; promotion trigger named; no architecture entry

- **Amends D10, D15.**
- **Question.** Routing doctrine sends external protocol clients to
  `drivers/*` (`standards/architecture/07-non-slice-families.md:40-41`;
  obs-websocket and ACP drivers are precedents), but Yeet's GitHub client is
  command-internal (`internal/github/*`), repo-cli already decodes
  harness-owned state (`Resume.ts:518`, `Provenance.ts:1360`), and no repo
  code speaks the socket. Fleet-coordination D7 defines rung-2 push as
  "acceleration of the mirror's facts"
  (`explorations/fleet-coordination/DECISIONS.md:322-325`).
- **Answer.** The sender is the D20 shell tail: a one-line socket write,
  token read from env and never logged. Any TypeScript reader goes through
  `internal/cli/EnvConfig.ts`, the socket path as an optional string and the
  token through `readOptionalRedactedConfigString` (`Config.Redacted`). The
  promotion trigger is named: a second non-repo-cli consumer, or the client
  growing handshake/framing/retry/redaction, moves it to
  a new Claude Code driver package under `packages/drivers/` with `@beep/repo-cli` composing it
  (07:251-257). No `standards/architecture/DECISIONS.md` entry: none of
  D1–D27 meets all three criteria (architecture-wide change, hard to reverse,
  resolves a tradeoff or known unknown). D15 is a distinct PR-event delivery,
  not fleet rung 2, and cites `T6-cross-session-messaging.md:68-71`.
- **Rejected.** A new Claude Code driver package under `packages/drivers/` now plus a log entry modelled
  on the 2026-05-06 tooling-to-driver entry (repo-level capability for one
  consumer whose wire contract is unprobed). A repo-cli internal module
  (contradicts D20 unless the tail shells out to it).

### D27 — Appetite: one goal packet, three PR-sized slices in order

- **Question.** What budget does the locked design deserve?
- **Answer.** One goal packet, three PR-sized slices, days-scale each and
  about two weeks of lane time end to end: (1) producer — D23's widened
  measurement, `Converge.ts`, D16's loop contract and `job wait` wave return,
  D17's row and `cleared` ack, D22's exempt kit, D21's cursor, D3's env
  names, the law-text updates; (2) delivery — D20's probe gate, the shell
  tail, SessionEnd teardown, the retire-fence regression, a session census;
  (3) escalation — D18's pr-wave notifier and D19's unknown-liveness rule.
  The probe gate is the cut line: a failed probe cuts slice 2 to hook
  injection plus slice 3, never extends the budget. D5's ack pruning stays
  its own small PR.
- **Rejected.** Two goal packets (producer, then delivery + escalation).
  Producer slice only with delivery and escalation as MAP gates.

### Locked from the repo (no question asked)

Facts the audit settled without the operator; each is binding on the brief.

- **No architecture record.** Nothing in D1–D27 revises the five Known
  Unknowns (`standards/architecture/README.md:97-114`) or meets the
  three-criteria bar; `standards/architecture/GLOSSARY.md` is scoped to
  `standards/ARCHITECTURE.md` vocabulary (`:3-5`) and stays untouched;
  `12-observability.md` is left alone because a span-format edit trips Known
  Unknown #4's append rule. Tooling spans follow the entrenched
  `Yeet.<operation>` `Effect.fn` convention (274 of 634 repo-cli files); the
  producer needs no new span doctrine.
- **Vocabulary.** `lane` is triply overloaded and is the *check name* field
  in `YeetFailureCapsule` (`Inbox.ts:152`; row ids derive from it, `:797`).
  D8's contract sentence reads "producer and reader share one checkout";
  `checkout` is the row schema's own term (`Inbox.ts:170`, `:217`). No new
  row or capsule field is ever named `lane`. `wave`, `capsule`, `inbox row`
  and `owner session` are tooling-local terms defined in the brief and, with
  the producer slice, the yeet skill's inbox section (there is no Yeet
  runbook), not the glossary.
- **D8's binding reason** is `standards/git-worktrees.md:381-383` and
  `:105-113` (`.beep` is intentionally local to each worktree), not the
  AGENTS.md closeout habit; changing D8 would be an edit to that standard.
  `goals/fleet-mirror/PLAN.md:70-73` is scan-scoped and is not cited as
  doctrine; `sibling-collision` remains the one cross-checkout-delivered kind
  and stays producerless.
- **Row shape.** A row kind is an `S.Class` with `kind: S.tag("…")` added to
  the bare `S.Union` at `Inbox.ts:649-662`, each with its own capsule and id
  derivation: `base-conflict` keyed on `(prNumber, headSha)`, `pr-comment` on
  the GitHub comment id, so re-polls are idempotent and a push does not
  change it. The bare union is grandfathered for this row set; converting it
  to `S.toTaggedUnion` (`04-rich-domain-model.md:63-78`) is out of scope.
- **Hook session files.** `yeet-hook-session/v1` exists only in
  `yeet-inbox.sh` (`:155`, `:157`, an equality `select`). D4's first-seen
  stamp is an additive `firstSeenAt: { "<rowId>": "<iso>" }` map written in
  `mark_seen` (`:200-205`) for ids not already present, `schemaVersion`
  unchanged (a bump would re-announce every unacked row once per session for
  1,055 files). Pruning of `seenIds`/`firstSeenAt` folds into D5's PR.
- **Configuration.** `06-configuration-boundaries.md` is slice-scoped
  (`:3`, `:45-49`) and does not reach `.claude/hooks/*.sh`. The proof-job
  deny pattern (`ProofJob.ts:221`) strips any `/TOKEN/i` name before the
  allowlist, so `CLAUDE_CODE_MESSAGING_TOKEN` can never reach a detached job
  — D15's rejected "monitor posts directly" was blocked twice over. D3's two
  names pass the pattern; D3 is a two-string append to `ProofJob.ts:146-165`
  plus one assertion in `test/proof-job.test.ts:299-312`, and the forwarded
  id names the *spawning* session, so a monitor that outlives it reads dead —
  the intended input to D19.
- **D6 needs no convergence.** The conflict is already computed every poll
  at `MonitorLoop.ts:1198-1201`; the row lands beside `announceMonitorReadiness`
  (`:1361-1401`) and is independent of D23's extraction.
- **D14 reworded.** "The woken orchestrator dispatches under the pool law in
  force at wake time (AGENTS.md Volume pools); this packet takes no position
  on model choice." The earlier "standing directive" wording is withdrawn.
- **D15 corrections.** The hold window is 10 minutes on this workstation
  (`$HOME/.claude/settings.json:167`, `dialogExpiry: "10m"`; T6 §7
  `:311-315`; vendor default 5 m at T6 `:243-245`) — the figures in D15's
  question and third rejected option are superseded. `isolatePeerMachines:
  true` (`:172`) gates any cross-machine variant on approval;
  `crossSessionInbound` is unset.
- **D9 and D11 gates.** `MAP.md` is a decompose-stage artifact
  (`.claude/skills/explore/SKILL.md:79-83`, `:98-99`); the receiver gate's
  carried constraints — edge trigger with one reconciliation read and a
  60–120 s healing poll, `(PR, headSha)` debounce of 250–500 ms, the seven
  events and `repository.id + PR number + head SHA` routing
  (`c2-yeet-monitor-backpressure.md:372-381`, `:388-390`, `:407-409`) — live
  in `BRIEF.md`'s no-gos until then; the takeover gate names which of the
  four #921-removed surfaces (`goals/ship-velocity/SPEC.md:18-23`) it would
  restore.
- **Boundary history.** `README.md:64-70` is a dated Trail entry and is not
  rewritten; the current boundary is the Next Open Question block.
- **Memory doctrine.** The inbox is "operational agent state"
  (`04-decision-log.md:164-169`), not a memory service; the tail is not a
  Layer-2 successor. No new memory decision is needed.

## Grill-with-docs complete (2026-09-25)

Design tree after round 4 (changes from the 2026-09-24 tree in bold):

- **Scope (D1):** unchanged.
- **Producer (D2, D6, D7, D12, D13 as amended by D16, D17, D21, D22, D23,
  D24):** `--until-ready` runs the extracted convergence every 30 s with
  full-fidelity checks; **reds and conflicts are non-terminal and `job wait`
  returns on a wave**; `base-conflict` P0 with a producer-written `cleared`
  ack; `pr-comment` P1 from a per-consumer cursor with the backlog as rows;
  one shared wave-exempt kit (threads and comments survive a push, drift does
  not); the ~42 s durable p95 is a recorded trade.
- **Delivery (D8, D10, D15 as amended by D20, D26):** same checkout; **a
  probe-gated shell tail** posts one message per wave into its own session;
  hook-side sender with a named promotion trigger; distinct from fleet rung 2.
- **No owner (D11 as amended by D18, D19):** **a new pr-wave notifier** on
  the existing transport ladder; **unknown liveness escalates**; takeover
  stays a MAP gate.
- **Fixing (D14, reworded):** the woken orchestrator dispatches under the
  pool law in force; no launcher.
- **Push source (D9):** the poll; the receiver gate carries c2's constraints.
- **Attribution (D3):** two allowlist names, amending ttc ruling 39.
- **First slice (D4 as amended by D23):** four check fields plus first-seen
  stamps.
- **Appetite (D27):** one goal packet, three PR-sized slices.
- **Outside (D5):** ack pruning plus `seenIds`/`firstSeenAt` pruning, one
  small PR.

Records placed outside the packet on 2026-09-25: proposed amendments under
ttc rulings 39, 41, 42, 46 and 48 (`goals/time-to-certainty/research/decisions.md`,
round 22); ttc `PLAN.md` B7 annotation; ship-velocity `SPEC.md` A1 and
`PLAN.md` A1 annotations. Frontier empty; the packet stays at `shape` and
`BRIEF.md` follows.

## 2026-09-25 — shape review round 5 (brief walkthrough under `/grill-with-docs`)

Source: `BRIEF.md` walked section by section with the operator, three
AskUserQuestion rounds, eleven questions, recommended answer first, every
recommendation accepted. Repo checks before asking: `yeetMonitorExitFor`
has only exit codes 0 and 1 (`MonitorPolicy.ts:251-310`); the SessionStart
entry has no matcher and fires on startup, resume, clear and compact
(`.claude/settings.json:201-215`); SessionEnd runs only `hook-pulse.sh`
(`:253-262`); from a systemd unit the notifier ladder has notify-send and
ntfy but no OSC 777 (`sequence-break-notifier.sh:492`, `:37-39`); D9's
snapshot collapse was absent from the brief; no Yeet runbook exists.

### D28 — Problem statement names the reframing

- **Answer.** `BRIEF.md` §Problem says outright that the packet does not
  chase seconds: event-to-row latency is a recorded trade (D24) and a
  decompose-stage gate (D9); the problem is capture, attribution and
  delivery. **Rejected.** Keeping "within seconds" as the aspiration; leaving
  the reframing implicit.

### D29 — Cut-line fallback is nothing new

- **Answer.** A failed socket probe closes slice 2 as cut: the result is
  recorded in `research/`, idle-owner wake stays hook injection at the next
  tool call plus the desktop switch, slice 3 still ships. **Rejected.**
  Reviving the monitor-posts-directly hold (10 m drop); a
  `crossSessionInbound` opt-in.

### D30 — Vocabulary home is the yeet skill's inbox section

- **Answer.** The five tooling-local terms land in
  `.claude/skills/yeet/SKILL.md`'s inbox section with the producer slice
  (which already rewrites its wave paragraph). **Rejected.** A new inbox runbook
  under `docs/runbooks/`; packet-only.

### D31 — Wave return is exit 2 and never acks the wave rows

- **Answer.** `job wait` gains outcome `wave` with exit code 2 so scripts can
  tell it from a red (1). The wave rows stay live — the hook injects them and
  the P0 Stop gate holds until the fix lands; only the proof-job row is
  observed-acked at settle, as today; the job keeps running. **Rejected.**
  Observed-acking the wave rows on return (loses the gate and the render);
  reusing exit 1.

### D32 — Comment backlog window is the job's submit time

- **Answer.** `pr-comment` rows are produced for comments created after the
  job's submit time; older comments only advance the watermark. The accepted
  miss is a comment posted between a previous monitor's exit and this
  submit. **Rejected.** Since the head's `pushedAt` (a committer date); full
  history capped at N.

### D33 — Comment row carries URL, author and a bounded excerpt

- **Answer.** About 200 characters of excerpt plus the URL and author; the
  full body is one `gh` read away. **Rejected.** URL and author only
  (content-free rows; every triage costs a fetch); the full body (unbounded
  rows in the file the 2 s hook scans).

### D34 — D9's snapshot collapse is a post-measurement follow-up in the goal

- **Answer.** Outside the three slices: once slice 1's push → row → ack
  timeline shows whether the `--watch` snapshot or the `--until-ready` Status
  chain is the cost, collapse that one as its own small PR inside the goal.
  **Rejected.** Slice 1 (widens the largest slice with `--watch`-path work);
  dropping the collapse.

### D35 — Tail spawn is idempotent per session id; teardown is an operator-registered SessionEnd command

- **Answer.** The SessionStart hook writes a pid file keyed by session id
  with the tail's pid and `/proc` start identity and returns when a live tail
  exists, so resume and compact do not spawn a second tail. Teardown is a
  second SessionEnd command the operator adds beside `hook-pulse.sh`; the
  self-reap covers crashes. **Rejected.** A `startup`-only matcher (resumed
  sessions never get a tail); spawning from `yeet monitor` submit (one tail
  per submit, only for sessions that ran a monitor).

### D36 — Escalation is monitor-side with notify-send and ntfy; OSC 777 is out of the path

- **Answer.** The detached unit is the only process that knows there is no
  live owner, so it spawns the pr-wave notifier with the wave descriptor.
  Transports from a unit: notify-send (DBUS forwarded by ttc ruling 39) and
  ntfy (`BEEP_SEQUENCE_BREAK_NTFY_*` forwarded by the `BEEP_` prefix only when
  the submitting shell exported it; absence recorded as
  `transport-unconfigured`). Ghostty's OSC 777 needs a terminal.
  **Rejected.** Routing through a live session's tail (a dead owner has no
  tail); ntfy only.

### D37 — Three rabbit holes added

- **Answer.** SessionStart is not one-shot; `.beep/inbox/` may not exist
  when the tail starts; notifier configuration reaches the unit only by
  inheritance. The backlog-window entry is rewritten as decided.
  **Rejected.** Only the SessionStart trap; keeping the list at eleven.

### D38 — Two no-gos added

- **Answer.** No change to `--watch` beyond the shared exempt kit and the
  extracted `Converge.ts` it imports; no snapshot collapse inside the three
  slices. **Rejected.** Only the `--watch` fence; keeping nine no-gos.

Frontier empty. The brief is updated in place; the packet stays at `shape`
until the operator says it matches the picture in their head.

## 2026-09-25 — shape exit and decompose

The operator advanced the packet ("Lets do the next step") after the
walkthrough; that is the shape exit — the brief matches. `MAP.md` names one
promised-now goal, slug `yeet-pr-events` (chosen by the orchestrator beside
the existing `yeet-*` goal names; rename before graduate if wanted), with the
three slices of D27 as workstreams W1–W9, the D34 collapse as W10, and the D9
receiver and D11 takeover as gated re-entry candidates. No new decision was
needed; every workstream cites a brick verified in rounds 4–5.

## 2026-09-25 — graduate

Definition-of-ready: brief complete (walked and confirmed), `openQuestions`
empty, `MAP.md` names one promised-now goal with sequencing and the first
vertical slice, every workstream cites a brick or is marked NET-NEW.
Graduated into `goals/yeet-pr-events` as a `paused` packet (execution was
not authorized in the scaffold session); the goal's `SPEC.md` condenses
D1-D38 into its decision log and links back here. Gated candidates stay in
`MAP.md`; a fired gate reopens this packet at `decompose`.
