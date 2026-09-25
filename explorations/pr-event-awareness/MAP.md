# Map — candidate goal packets

<!--
Stage 4. Decompose-stage output, grounded in BRIEF.md (drafted and walked
2026-09-25; the operator advanced the packet to decompose) and DECISIONS.md
D1–D38. Every major component cites an existing repo capability by file:line
(verified 2026-09-25) or is marked NET-NEW. Compose the bricks; do not
rebuild them.
-->

## Candidate goals

### 1. `yeet-pr-events` (promised now — the only goal this packet spawns)

**Mission:** make `yeet monitor --until-ready` the durable producer of every
PR event that matters — required reds, base conflicts, review threads, human
comments — as attributed, per-head-coalesced inbox rows; hand them to the
owning session whether it is blocked in `job wait`, idle, or dead; and prove
the push → row → ack timeline the cadence question is decided on.

**Dependencies:** none for slice 1, which merges alone. Slice 2 is gated on
the socket probe (D20). Slice 3 needs slice 1's rows and D3's attribution.
Later dependency, not a blocker: the resume-footer Codex live guard
(`goals/yeet-pr-resume-footer/SPEC.md:27-28`) — until it ships every
Codex-attributed owner escalates (D19).

**Appetite (D27):** one goal packet, three PR-sized slices in order, about
two weeks of lane time; the probe is the cut line.

**Workstreams (sequenced):**

| # | Slice | Workstream | What ships | Capability citation |
| --- | --- | --- | --- | --- |
| W1 | 1 producer | Check fidelity + measurement (D4, D23) | `gh pr checks --json` request grows to `name,state,bucket,link,workflow,completedAt,startedAt`; `GhStatusCheck` +4 `S.optionalKey`; `YeetStatusRemote.checks` → `S.Array(YeetWatchCheck)` via `withKeyDefaults`; hook `firstSeenAt` map; push → row → ack timeline per head | Request site `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:868`, `GhStatusCheck` `:497-506`, `checks` `:249`, `withKeyDefaults` idiom `:253`, classify/discard `:1314-1323`, encode `:1811`; `YeetWatchCheck` `WatchStream.ts:152-158`; legacy fixture `packages/tooling/tool/cli/test/yeet-status-triage.test.ts:861-869`; hook session state `.claude/hooks/yeet-inbox.sh:155`, `:157`, `mark_seen` `:200-205`; head timeline `MonitorPolicy.ts` (`YeetHeadTimeline`). Field widening and stamps NET-NEW. |
| W2 | 1 producer | `Converge.ts` + loop contract + wave return (D16, D23, D31) | Extract the private convergence with a narrowed signature; `--until-ready` runs it every poll; `required-red` and the conflict non-terminal; `job wait` outcome `wave`, exit 2, rows unacked | `convergeYeetWatchDispatch` `WatchMode.ts:595-656` (callers `:824`, `:1010`); `dispatchYeetCheckFailure` `Remediation.ts:670-729`; only `MonitorLoop` importer `Porcelain.ts:36`; terminals `MonitorPolicy.ts:197-213`, exit table `:251-310`; `triageMonitorReds` `MonitorLoop.ts:1442-1450`; `ProofJobLauncher.wait` `ProofJobLauncher.ts:498-527`, poll interval `ProofJob.ts:1139`. `Converge.ts` module, `wave` outcome and exit 2 NET-NEW. |
| W3 | 1 producer | Conflict row + `cleared` ack (D6, D17) | P0 `base-conflict` `S.Class` row keyed `(prNumber, headSha)`; `conflictRow` guard; seventh ack kind `cleared` written on same-head MERGEABLE | `yeetBaseConflictFor` `Settle.ts:479-487` called at `MonitorLoop.ts:1198-1201`; append template `announceMonitorReadiness` `:1361-1401`, `appendYeetInboxRowOnce` `:1385`, `announcedRow` `:1373`; `YeetAckResolutionKind` `Ack.ts:46`; receipt writer `writeYeetAckReceipt` (used `ProofJobLauncher.ts:505`); settle reason literal `CheckOutcome.ts:86-92`. Row kind and ack kind NET-NEW. |
| W4 | 1 producer | Comment rows + per-consumer cursor (D13, D21, D32, D33) | P1 `pr-comment` rows keyed on comment id (URL, author, ~200-char excerpt); watermark namespaced per consumer; first-cycle backlog after the job's submit time becomes rows | Replay `MonitorLoop.ts:1469-1471`; `replayYeetMonitorComments` → ack `MonitorComments.ts:1559`, file `:490`, path `:509-512`; branch-only `runId` `ArtifactPaths.ts:225-228`, `:303-311`; chain `MonitorComments.ts:1098-1122`; watch ack `WatchMode.ts:753`. Namespacing and row conversion NET-NEW. |
| W5 | 1 producer | Wave-exempt kit + hook parity (D7, D22) | `YeetInboxWaveExemptRowKind`; `yeetInboxRowLiveness` reads it; hook jq literal; repo-cli test asserts hook literal == kits | Union `Inbox.ts:649-662`, row shape `:209-220`, kits `:98`, `:693`, `yeetInboxRowIsObserved` `:749`, ids `:797`, `:851`, `:634`; CLI liveness `InboxView.ts:154-166`; hook liveness `.claude/hooks/yeet-inbox.sh:139-149`; test alias law `AGENTS.md` (`@beep/*` imports in `test/`). Kit and parity test NET-NEW. |
| W6 | 1 producer | Attribution + law text (D3, D25) | Two allowlist names; AGENTS.md closeout bullet; yeet skill wave/exit text + vocabulary block; `CheckOutcome.ts`/`Remediation.ts` JSDoc; ttc exit-table amendment ratified by this PR | Allowlist `ProofJob.ts:146-165`, prefixes `:182`, deny `:221`, filter `:1224-1231`; test `packages/tooling/tool/cli/test/proof-job.test.ts:299-312`; `classifyHarness` `Provenance.ts:1301-1302`; `AGENTS.md:144-153`; `.claude/skills/yeet/SKILL.md:202-211`, `:491-497`; `CheckOutcome.ts:63-64`; `Remediation.ts:14-18`. Text only. |
| W7 | 2 delivery | Socket probe gate (D20, D29) | Three senders (in-hook child, `&` child, `setsid -f` child); one accepted frame, one refusal, delivery matrix into a bypass session; written to `research/` | Socket facts `explorations/fleet-coordination/research/T6-cross-session-messaging.md:58-71`; `RESEARCH.md` §4 harness primitives; detach precedent `.claude/hooks/hook-pulse.sh:425`; workstation `dialogExpiry` 10 m (`$HOME/.claude/settings.json:167`). Probe artifacts NET-NEW; a failed probe closes slice 2 as cut. |
| W8 | 2 delivery | Session-owned inbox tail (D15, D20, D26, D35) | Shell worker beside `yeet-inbox.sh`; SessionStart spawn idempotent via session-keyed pid file + `/proc` start identity; `inotifywait` on `.beep/inbox/`; one message per new P0/P1 wave into `$CLAUDE_CODE_MESSAGING_SOCKET`; cwd outside the lane; self-reap on the session pid; SessionEnd teardown (operator-registered); retire-fence regression; fleet census | SessionStart entry `.claude/settings.json:201-215` (2 s, no matcher), SessionEnd `:253-262`, agent `Edit` deny `:85`; retire fence `Worktree.service.ts:1289-1300`, holders `internal/repo-run/ProcessAttachment.ts:96-126`; pid-reuse fence `internal/repo-run/ProcessIdentity.ts:195`, `:299`, `:347`; redacted config reader `internal/cli/EnvConfig.ts:161-162` (any TS reader); only in-repo watcher precedent `packages/foundation/modeling/utils/src/FileSystem.ts:507-515` (not used; the tail is shell); `/usr/bin/inotifywait` present. Tail script, pid file, teardown command NET-NEW. |
| W9 | 3 escalation | pr-wave notifier + liveness rule (D11, D18, D19, D36) | Monitor-side no-live-owner check (unknown = dead) spawns a sibling notifier with the wave descriptor; notify-send + ntfy; resolves on the row's ack; own ledger namespace; local body carries `yeet resume <pr>` | Liveness probe `Resume.ts:234-266` (`:239` Claude-only, call `:518`); registry rows `PrSessionRegistry.ts`; transports `.claude/hooks/sequence-break-notifier.sh:37-39` (ntfy env), `:441-549` (desktop), `:561-667` (ntfy), `:492` (OSC 777, terminal-only, out of path); env forwarding (DBUS, `BEEP_` prefix) ttc ruling 39 / `ProofJob.ts:146-182`. Notifier script, liveness check and ledger namespace NET-NEW; the existing notifier is untouched. |
| W10 | follow-up | Snapshot collapse (D9, D34) | Collapse whichever chain the W1 timeline blames — the watch's ten GraphQL requests or the Status chain — as one small PR inside the goal | Watch snapshot `WatchMode.ts:232`, `collectYeetWatchSnapshot` `:381-465` (sequential `Effect.all` `:403`); Status chain `Status.ts:868`, `:1281-1284`. NET-NEW query composition; not slice work. |

**First vertical slice (slice 1, proven on the goal's own PR):** a PR with a
synthetic required red is babysat by a detached `--until-ready`; the monitor
writes a full-fidelity `check-failed` row (bucket, state, link, workflow,
timestamps) and pins the wave; `job wait` returns exit 2 with the row still
live; the hook injects the row at the next tool call with a working link; the
fix push supersedes the wave; `job wait` re-run on the same job reaches
`ready` exit 0; the push → row → ack timeline for that head prints from the
new stamps. Verified by repo-cli tests (exit table and `wave` outcome, legacy
`status.json` decode through `withKeyDefaults`, hook-literal parity, conflict
row idempotence, comment-window bound) plus one real babysit: the producer
PR's own closeout is the proof, and its timeline is the first W1 measurement.

**Inherited risks (BRIEF rabbit holes, one line each):**

- The socket wire contract is unspecified; the probe is the only way in.
- `setsid -f` reparents to the `systemd --user` subreaper, so both ancestry
  fences (retire, own-child provenance) may reject the tail — cut, do not stretch.
- A P0 row under `unknown` liveness blocks Stop until an attributed ack;
  `cleared` covers only the same-head case (documented behaviour, not a fix).
- Comment backlog window is the job's submit time; the accepted miss is a
  comment between a previous monitor's exit and this submit.
- `job wait` returns only for waves on the job's own PR.
- Widen `YeetStatusRemote.checks` with `withKeyDefaults`, never constructor
  defaults; the legacy fixture must still decode.
- External status contexts may leave `startedAt`/`completedAt` null.
- The hook parity test reads one marked jq line out of a shell file.
- Existing `monitor-comments.json` files are unnamespaced; first namespaced
  run must not replay history.
- One tail per session across 64 checkouts; the `/proc` start-identity reap,
  not SessionEnd, is the guarantee on a crash.
- `inotifywait` on a dotfile directory and NDJSON append offsets are
  unmeasured; `failures.ndjson` is never rotated.
- SessionStart has no matcher (startup, resume, clear, compact); the pid file
  is what keeps the tail single.
- `.beep/inbox/` may not exist when the tail starts.
- Notifier ntfy configuration reaches the unit only by env inheritance.

## Sequencing

1. **Slice 1 (W1–W6)** is the first and only unconditional bet: it merges
   alone and pays even if nothing else ships — durable rows for every event
   class, a wave return on the blocking recipe, and the timeline every later
   cadence argument needs. W1 lands first inside the slice because W2's
   `check-failed` rows are a degraded copy without it.
2. **Slice 2 (W7 → W8)** is gated: W7 is a one-hour probe whose result is a
   packet artifact either way; W8 exists only if W7 delivers from a detached
   child into a bypass session. A failed probe closes the slice as cut (D29).
3. **Slice 3 (W9)** depends on slice 1's rows and D3's attribution but not on
   slice 2; it can land before W8 if the probe stalls.
4. **W10** is a follow-up keyed to the W1 timeline, never scheduled ahead of it.

Outside the goal: ack, `seenIds` and `firstSeenAt` pruning is its own small
PR (D5), not a workstream.

## Gated candidates (re-entry points, not goals)

Neither candidate holds this packet open. A fired gate reopens the
exploration at `decompose`; it does not spawn a goal directly.

- **`pr-event-webhook-receiver`** — fires when the W1 timeline shows
  event-to-row latency is what hurts (D9). Carried constraints from
  `goals/ship-velocity/research/c2-yeet-monitor-backpressure.md:371-390`,
  `:407-409`: the receiver is an edge trigger, never sole truth — one
  conditional reconciliation read on receipt and a 60–120 s healing poll;
  `(PR, headSha)` debounce of 250–500 ms for matrix bursts; the seven PR
  events; routing by `repository.id + PR number + head SHA`. The existing
  `workflow_job` webhook belongs to the CI fleet autoscaler
  (`infra/src/CiFleetController.ts`) and is not reused.
- **`pr-owner-takeover`** — fires when slice 3's escalation ledger shows
  dead-owner PRs going unresumed past a bound the goal sets. Must name which
  of the four surfaces PR #921 removed (`goals/ship-velocity/SPEC.md:18-23`:
  ownership lease, watcher, takeover, mutation fence) it would restore, and
  why the fence no longer applies.

## Explicitly not goals

- Any launcher or auto-dispatched fixer lane (D14); the woken orchestrator
  dispatches under the pool law in force.
- Cadence changes or an adaptive regime (D12, D24); `--watch` stays at 10 s
  and changes only through the shared exempt kit and `Converge.ts` (D38).
- Cross-checkout delivery or a workstation-level inbox (D8).
- A new Claude Code driver package under `packages/drivers/`, an architecture decision-log
  entry, a glossary entry, or a `12-observability.md` edit (D26).
- Settings-level opt-ins (`crossSessionInbound`, cross-machine delivery).
- Any change to `sequence-break-notifier.sh` or `hook-pulse.sh` invariants.

## Capability check verdict

Every workstream cites a live brick by file:line, verified 2026-09-25. The
NET-NEW items are thin layers over existing seams, not rebuilt bricks: a
module extraction (`Converge.ts`), one job-wait outcome and exit code, two
`S.Class` rows and one ack kind on existing unions, one `LiteralKit`, a
namespaced key in an existing watermark file, an additive map in the hook's
session file, two shell workers beside existing hooks, and a probe that
writes prose. The only NET-NEW item with no in-repo precedent at all is the
socket sender, which is why it is gated on the probe rather than designed.
