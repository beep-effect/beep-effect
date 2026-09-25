# Yeet PR Events Spec

Normative contract. Packet anchor document. Repo instructions and governing
standards outrank this file when they conflict. This spec was seeded on
2026-09-25 from the operator-confirmed
[`BRIEF.md`](../../explorations/pr-event-awareness/BRIEF.md), the ratified
[`MAP.md`](../../explorations/pr-event-awareness/MAP.md), and the
[`DECISIONS.md`](../../explorations/pr-event-awareness/DECISIONS.md) log
(D1-D38). Those links preserve provenance; this packet states the execution
contract in its own words.

## Objective

Make `yeet monitor --until-ready` the durable producer of every PR event that
matters — required reds, base conflicts, review threads, human comments — as
attributed, per-head-coalesced inbox rows; hand them to the owning session
whether it is blocked in `job wait`, idle, or dead; and measure the
push → row → ack timeline the cadence question is decided on.

## Non-goals

- Do not add a launcher or auto-dispatched fixer lane, a `yeet repair`
  hybrid, or any model-choice directive in dispatch; the woken orchestrator
  dispatches under the pool law in force.
- Do not change cadence: the `--until-ready` loop stays at 30 s, `--watch`
  at 10 s, and no adaptive regime is added. The ~42 s durable p95 is a
  recorded trade against ship-velocity A1.
- Do not build a webhook receiver or automatic owner takeover. Both are
  gated re-entry candidates in the exploration's `MAP.md`.
- Do not add cross-checkout delivery or a workstation-level inbox;
  `sibling-collision` stays producerless.
- Do not create `packages/drivers/claude-code`, a
  `standards/architecture/DECISIONS.md` entry, a glossary entry, or a
  `12-observability.md` edit. The promotion trigger for the socket sender is
  named in the constraints.
- Do not set `crossSessionInbound`, enable cross-machine delivery, or edit
  `.claude/settings.json` from an agent; the operator registers hook wiring.
- Do not change `sequence-break-notifier.sh` or `hook-pulse.sh` invariants.
- Do not change `--watch` beyond the shared wave-exempt kit and the extracted
  `Converge.ts` it imports; do not run the snapshot collapse inside a slice.
- Do not prune the ack directory, `seenIds` or `firstSeenAt`; that is its own
  small PR.

## Source hierarchy

1. The operator objective that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture and package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target surfaces

- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts` (the
  `gh pr checks --json` request, `GhStatusCheck`, `YeetStatusRemote.checks`).
- `.../internal/WatchMode.ts` and a new `.../internal/Converge.ts` (the
  extracted convergence; `WatchMode` and `MonitorLoop` both import it).
- `.../internal/MonitorLoop.ts`, `MonitorPolicy.ts` (terminal sets, exit
  table), `Settle.ts` (`yeetBaseConflictFor`), `MonitorComments.ts` and
  `ArtifactPaths.ts` (the comment watermark), `Remediation.ts`.
- `.../internal/Inbox.ts`, `InboxView.ts`, `Ack.ts` (two rows, one kit, one
  ack kind, liveness).
- `.../internal/ProofJob.ts` and `ProofJobLauncher.ts` (allowlist; the
  `wave` outcome of `job wait`); `CheckOutcome.ts` JSDoc.
- Tests under `packages/tooling/tool/cli/test/` (imports through `@beep/*`).
- `.claude/hooks/yeet-inbox.sh` (`firstSeenAt`, exempt-kind literal) and two
  new shell workers beside it: the inbox tail and the pr-wave notifier.
- Law text: `AGENTS.md` PR-closeout bullet; `.claude/skills/yeet/SKILL.md`
  wave, exit-code and vocabulary text; the ttc decision log's proposed
  amendments under rulings 39, 41, 42, 46 and 48 (ratified by the slice-1
  PR's merge).
- `explorations/pr-event-awareness/research/` for the W7 probe record.

## Workstreams

| Workstream | Required result |
| --- | --- |
| W1 check fidelity + measurement | `Status.ts` requests `name,state,bucket,link,workflow,completedAt,startedAt`; `GhStatusCheck` gains the four as `S.optionalKey`; `YeetStatusRemote.checks` becomes `S.Array(YeetWatchCheck)` through `SchemaUtils.withKeyDefaults`; the hook's session file gains an additive `firstSeenAt` map with `schemaVersion` unchanged; a push → row → ack timeline per head prints from the new stamps. |
| W2 `Converge.ts` + loop contract + wave return | The private convergence moves to `internal/Converge.ts` with its signature narrowed to the fields it reads; `dispatchYeetCheckFailure` takes `{ headSha, prNumber }`; `--until-ready` runs the convergence every poll; `required-red` and the base conflict are non-terminal under `--until-ready`; `job wait` gains outcome `wave` with exit code 2, scoped to the job's own PR, never acking the wave rows. |
| W3 conflict row + `cleared` ack | A P0 `base-conflict` `S.Class` row with `kind: S.tag("base-conflict")`, keyed on `(prNumber, headSha)`, written at the existing `yeetBaseConflictFor` site with a `conflictRow` guard beside `announcedRow`; a seventh `YeetAckResolutionKind`, `cleared`, attributed to the monitor job, written when the same head is observed mergeable again. |
| W4 comment rows + per-consumer cursor | A P1 `pr-comment` row per human, non-self, top-level comment, keyed on the comment id, carrying URL, author and an excerpt of about 200 characters; the comment watermark namespaced per consumer mode; the `--until-ready` first-cycle backlog, bounded to comments created after the job's submit time, becomes rows instead of stdout. |
| W5 wave-exempt kit + hook parity | `YeetInboxWaveExemptRowKind = LiteralKit(["review-thread", "pr-comment"])`; `yeetInboxRowLiveness` reads it; the hook carries the exempt-plus-observed union as one marked jq literal line; a repo-cli test parses that line and asserts it equals the kits; `base-drift` keeps superseding on a push. |
| W6 attribution + law text | `CLAUDE_CODE_SESSION_ID` and `CODEX_THREAD_ID` join `PROOF_JOB_FORWARDED_ENV_NAMES` with one test assertion; `AGENTS.md`, the yeet skill, `CheckOutcome.ts:63-64` and `Remediation.ts:14-18` describe the shipped behaviour; the vocabulary block (checkout, inbox row, capsule, wave, owner session) lands in the yeet skill. |
| W7 socket probe gate | From a live session, post to `$CLAUDE_CODE_MESSAGING_SOCKET` from an in-hook child, a plain background child and a `setsid -f` child; record one accepted frame, one refusal, and which senders a bypass session delivers, in the exploration's `research/`. A failed probe closes slice 2 as cut. |
| W8 session-owned inbox tail | A shell worker beside `yeet-inbox.sh`, spawned by the SessionStart hook inside its 2 s budget, idempotent per session id through a pid file recording pid and `/proc` start identity, `inotifywait` on `.beep/inbox/`, one message per new P0/P1 wave (a pointer plus a one-line attributed summary) into the session's socket, cwd outside the lane and one inotify fd, token read from env and never logged, self-reap on the session pid, teardown registered by the operator on SessionEnd. |
| W9 pr-wave notifier + liveness rule | When no live owner exists in the PR session registry (unknown counts as dead), the monitor spawns a sibling notifier with the wave descriptor; transports notify-send and ntfy; resolves on the row's ack; own ledger namespace; the local body may carry `yeet resume <pr>` and a one-line summary, ntfy and the ledger stay generic. |
| W10 snapshot collapse (follow-up) | After the W1 timeline names the costly chain, collapse it — the watch's ten GraphQL requests to one, or the Status chain — as one small PR. |

## Constraints

- Slice 1 is W1-W6 in one PR; W1 lands first inside it because W2's rows are
  a degraded copy without it. The slice's proof is its own babysit: a
  synthetic required red, a full-fidelity `check-failed` row, `job wait`
  exit 2 with the row live, hook injection with a working link, the fix push
  superseding the wave, `job wait` re-run reaching `ready` exit 0, and the
  timeline printed.
- Vocabulary: `checkout` names the repository root; `lane` is never used
  for a worktree in code, rows, capsules or packet prose (it is the
  check-name field in `YeetFailureCapsule` and a pool/quality lane elsewhere).
- Row shape: an `S.Class` with `kind: S.tag("…")` added to the existing bare
  `S.Union`; no `LiteralKit` for the row-kind set; the bare union is
  grandfathered, not converted to `S.toTaggedUnion`. Each new row has its own
  deterministic id derivation.
- `YeetStatusRemote.checks` widens through `withKeyDefaults`, never
  `withConstructorDefault`; the hand-written legacy snapshot in
  `test/yeet-status-triage.test.ts` must keep decoding.
- `job wait` returns only for waves on the job's own PR; two monitors in one
  checkout on different PRs must not wake each other's waiter. The wave rows
  are never acked by the return; only the proof-job row is observed-acked at
  settle.
- A P0 row under `unknown` liveness (missing or stale `dispatch.json`)
  blocks Stop until an attributed ack; this is documented behaviour, not a
  defect to fix here. `cleared` covers only the same-head case.
- Comment rows: the backlog window is the job's submit time; the accepted
  miss is a comment posted between a previous monitor's exit and this
  submit. Existing unnamespaced `monitor-comments.json` files must not
  replay history as rows on the first namespaced run.
- External status contexts may leave `startedAt` and `completedAt` null; the
  measurement tolerates absence.
- Hook parity: the exempt-kind list is one marked line in `yeet-inbox.sh`;
  the parity test reads exactly that line.
- No tail code before the W7 probe record exists. If the harness delivers
  from none of the detached senders, slice 2 is closed as cut, W8 is marked
  skipped with the reason, and no rejected D15 option (direct post with the
  10 m hold, `crossSessionInbound`) is revived.
- The tail's cwd stays outside the lane and it holds only an inotify fd, so
  `ancestryPidsOf` never sees it as a blocking holder; a regression test
  proves `bun run beep yeet sweep --retire` succeeds with the tail running.
  `setsid -f` reparents to the `systemd --user` subreaper, not the session
  pid; the `/proc` start-identity reap, not SessionEnd, is the crash
  guarantee. SessionStart has no matcher and fires on startup, resume, clear
  and compact; the session-keyed pid file keeps the tail single.
  `.beep/inbox/` may not exist when the tail starts.
- Any TypeScript reader of the socket path or token goes through
  `internal/cli/EnvConfig.ts`, the token as `Config.Redacted`. Promotion
  trigger for the sender: a second non-repo-cli consumer, or growth into
  handshake/framing/retry/redaction, moves it to `packages/drivers/claude-code`
  with `@beep/repo-cli` composing it.
- Escalation is monitor-side. From a unit, notify-send needs
  `DBUS_SESSION_BUS_ADDRESS` (forwarded) and ntfy needs
  `BEEP_SEQUENCE_BREAK_NTFY_*` (forwarded only when the submitting shell
  exported it; absence is recorded as `transport-unconfigured`). OSC 777 is
  terminal-only and out of this path. `isClaudeSessionLive` is Claude-only:
  every Codex-attributed owner escalates until the resume-footer Codex live
  guard ships; that guard is a later dependency, not a blocker.
- Law text ships with the code it describes (slice 1); the operator
  registers `.claude/settings.json` changes; the ttc amendments proposed on
  2026-09-25 are ratified by the slice-1 PR's merge.
- Tooling spans, if any, follow the existing `Yeet.<operation>` `Effect.fn`
  convention; no new span doctrine.
- Tests import package source through `@beep/*` aliases; the package
  handoff runs `bun run beep quality package-verify @beep/repo-cli`.
- Push each fix as soon as it is finished; never hold a PR update for local
  verify, the local proof, or scheduler admission.

## Decision log

Condensed from the exploration's D1-D38; the linked log carries every
question, rejected option and cite.

| Date | Question | Answer | Rationale |
| --- | --- | --- | --- |
| 2026-09-24 | D1 What does this packet add over the desktop `set_monitor auto_fix` switch? | Yeet-side durable capture and attribution; the switch is one wake vector. | The switch is app-only, session-scoped, unattributed and dies with the session; rows survive an owner's death. |
| 2026-09-24 | D2/D16 Which loop is the producer and what is its terminal contract? | `--until-ready` runs the convergence every poll; reds and conflicts are non-terminal; `job wait` returns exit 2 on a wave. | The canonical recipe must outlive the first red; `--until-merged` is rejected by ttc ruling 42; re-arm per fix is today's failure. |
| 2026-09-24 | D3 How does a detached monitor attribute its owner? | Forward `CLAUDE_CODE_SESSION_ID` and `CODEX_THREAD_ID` through the proof-job allowlist. | Registry rows from detached jobs are otherwise `harness=unknown`; amends ttc ruling 39. |
| 2026-09-24 | D4/D23 What ships first? | Measurement plus fidelity: four check fields, `withKeyDefaults`, `Converge.ts`. | Without link/workflow/bucket/state the `--until-ready` rows are a degraded copy. |
| 2026-09-24 | D6/D17 Conflicts? | P0 `base-conflict` row; a monitor-written `cleared` ack on same-head MERGEABLE; a new head supersedes through the wave. | Liveness reads only (headSha, prNumber); observed-kind acks pin liveness; the only same-head clear is an ack kind. |
| 2026-09-24 | D7/D22 Which rows survive a push? | Threads and comments through one shared kit consumed by both readers; drift does not. | Both readers already supersede thread capsules; two hand-synced lists drift. |
| 2026-09-24 | D8 Delivery scope? | Producer and reader share one checkout. | `.beep` is intentionally local to each worktree (`standards/git-worktrees.md`). |
| 2026-09-24 | D9/D34 Push source? | Keep the poll; receiver is a gated candidate; snapshot collapse after measurement. | A receiver buys ~8 s median against boards of 40-55 min and is moot without a producer. |
| 2026-09-24 | D11/D18/D19 No live owner? | Monitor-side pr-wave notifier on the transport ladder; unknown liveness escalates; takeover is a gate. | `sequence-break-notifier.sh` refuses non-permission callers and is content-free; the Codex live guard is unshipped. |
| 2026-09-24 | D12/D24 Cadence? | 30 s stays; the ~42 s durable p95 is a recorded trade against ship-velocity A1. | A new path under an old bar, not a regression; c2's split-lane design is the prior art if speed is needed. |
| 2026-09-24 | D13/D21/D32/D33 Comments? | P1 rows for human non-self top-level comments; per-consumer watermark; backlog after the job's submit time; URL + author + ~200-char excerpt. | One branch-keyed cursor is shared by `--watch` and `--until-ready`; the backlog otherwise burns to stdout or storms. |
| 2026-09-24 | D14 Who dispatches? | The woken orchestrator, under the pool law in force; no launcher. | Keeps judgment in the session; consistent with PR #921. |
| 2026-09-24 | D15/D20/D26/D35 Wake sender? | A probe-gated, SessionStart-spawned shell tail posting into its own session's socket; hook-side sender; idempotent per session id. | Own-child provenance is the one path a bypass session delivers unconditionally; the wire contract is unmeasured, so the probe gates the build. |
| 2026-09-25 | D25 Where do the records live? | Proposed ttc amendments now, ratified by slice 1; this goal owns the `--until-ready` producer extension; law text ships with code. | The ttc log stays the place the settle rulings are reachable from. |
| 2026-09-25 | D27 Appetite? | One goal packet, three PR-sized slices, about two weeks; the probe is the cut line. | Slice 1 pays alone; the budget never extends on a failed probe. |
| 2026-09-25 | D29/D36 Cut-line fallback and escalation transport? | Nothing new on a failed probe; notify-send + ntfy from the unit, no OSC 777. | Hook injection and the desktop switch already exist; a unit has no terminal. |

## Acceptance criteria

- [ ] W1: a `--until-ready` `check-failed` capsule matches a `--watch`
      capsule field for field; the legacy `status.json` fixture decodes; the
      hook session file carries `firstSeenAt` with `schemaVersion` unchanged;
      the push → row → ack timeline prints per head.
- [ ] W2: `required-red` and the base conflict do not end `--until-ready`;
      the wave is re-pinned across a fix push; `job wait` returns exit 2 on a
      new P0/P1 wave on its own PR with the rows still live, and reaches
      `ready` exit 0 on re-run; `MonitorLoop` and `WatchMode` both import
      `Converge.ts`.
- [ ] W3: one `base-conflict` row per head, idempotent across polls; a
      `cleared` ack lands only when the same head is observed mergeable.
- [ ] W4: `--watch` and `--until-ready` on one branch keep separate
      watermarks; the backlog becomes rows bounded by the submit time; the
      first namespaced run replays nothing.
- [ ] W5: both readers keep `review-thread` and `pr-comment` rows live across
      a push, supersede `base-drift`, and the parity test fails when the hook
      literal and the kits disagree.
- [ ] W6: registry rows from a detached monitor carry harness and session id;
      the named law text and the ttc amendments match the shipped behaviour.
- [ ] Slice 1's own babysit reproduces the first-vertical-slice sequence and
      its transcript is attached under `history/`.
- [ ] W7: the probe record exists with one accepted frame, one refusal and a
      delivery matrix; the slice-2 verdict is written.
- [ ] W8 (if built): survives the SessionStart timeout; delivers into a
      bypass session; `yeet sweep --retire` succeeds with the tail running;
      proxy-session delivery; the fleet census shows one tail per live
      session and no orphans.
- [ ] W9: a dead-owner wave produces a desktop and ntfy notification carrying
      `yeet resume <pr>` locally; `sequence-break-notifier.sh` is byte-identical.
- [ ] Package verify, focused tests, hook syntax and packet checks pass.
- [ ] Each required PR ships through `/yeet` to merge-ready with every review
      thread resolved.
- [ ] No unrelated refactors or formatting churn.

## Verification matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Focused tests | `bunx --bun vitest run packages/tooling/tool/cli/test/yeet-status-triage.test.ts packages/tooling/tool/cli/test/proof-job.test.ts` plus the new exit-table, wave-return, conflict-row, comment-window and hook-parity tests | Pass |
| Package handoff | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Hook syntax | `bash -n .claude/hooks/yeet-inbox.sh` and the two new workers | Passes |
| First vertical slice | The slice-1 PR's own babysit transcript (job id, exit 2, injected row, wave supersede, exit 0, timeline) | Attached under `history/` |
| Probe record | `explorations/pr-event-awareness/research/` W7 file | Present with the delivery matrix |
| Retire fence | `bun run beep yeet sweep --retire` from the lane with the tail running | Succeeds |
| Packet launcher size | `test "$(wc -m < goals/yeet-pr-events/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/yeet-pr-events/ops/manifest.json` | Passes |
| Goal packet doctor | `bun run beep goals doctor` | No finding caused by this packet |
| Goal index | `bun run beep goals index --check` | Passes |
| Whitespace | `git diff --check -- goals/yeet-pr-events goals/INDEX.md` | Passes |
| Delivery | `bun run beep yeet monitor --until-ready` | `merge-ready: yes`; zero unresolved review threads |

## Stop conditions

- The W7 probe delivers from none of the detached senders (close slice 2 as
  cut; do not improvise a sender).
- The retire fence rejects the tail even with cwd outside the lane.
- `withKeyDefaults` cannot keep the legacy `status.json` fixture decoding.
- The SessionStart hook cannot spawn and return inside its 2 s budget.
- The work needs `.claude/settings.json` edits, a `drivers/*` package, a
  settings-level opt-in, or a change to the sequence-break or hook-pulse
  invariants.
- Another owner has overlapping work in the Yeet internals or the hooks and
  coordination has not resolved it.
- Verification requires unnamed credentials, cost, destructive side effects,
  or policy approval.
- The same blocker repeats after reasonable investigation.

## Exception ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
