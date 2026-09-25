# Yeet PR Events Plan

## Status

Status: `active`

Slice 1 (W1-W6) is implemented on `feat/yeet-pr-events-slice-1`, with four
rulings the orchestrator ratified from the step reviews: a required red set
that changes on the same head is a new wave, optional reds never wake a
waiter, a REST actor typed `Bot` is a bot, and the yeet skill's comment-cursor
text names the per-mode files. P11 verification is in progress; P12 publishes
the slice-1 PR. W7-W10 have not started.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research inheritance | complete | Carry the confirmed exploration's problem, D1-D38, decomposition and source ledger into this packet. | `SPEC.md` and `research/SOURCES.md` trace every binding decision to the exploration. |
| W1 Check fidelity + measurement | complete | `gh pr checks --json` requests link, workflow, completedAt, startedAt; `YeetStatusRemote.checks` becomes `S.Array(YeetWatchCheck)` via `withKeyDefaults`; hook `firstSeenAt` map; push → row → ack timeline per head. | The legacy `status.json` fixture still decodes; a `--until-ready` capsule matches a `--watch` capsule field for field; the timeline prints. |
| W2 Converge + loop contract + wave return | complete | Extract `internal/Converge.ts`; run it every `--until-ready` poll; `required-red` and the conflict non-terminal; `job wait` outcome `wave`, exit 2, rows unacked. | Tests cover the exit table, the wave return scoped to the job's PR, and re-pin across a fix push. |
| W3 Conflict row + `cleared` ack | complete | P0 `base-conflict` row at the existing `yeetBaseConflictFor` site with a `conflictRow` guard; seventh ack kind `cleared` on same-head MERGEABLE. | Conflict row is idempotent per (head, generation); `cleared` lands only at the same head, and a conflict that returns after it writes generation + 1 as a new row and wave; a new head supersedes through the wave. |
| W4 Comment rows + per-consumer cursor | complete | P1 `pr-comment` rows (URL, author, ~200-char excerpt) keyed on comment id; watermark namespaced per consumer; backlog after the job's submit time becomes rows. | `--watch` and `--until-ready` on one branch no longer share a cursor; the first namespaced run replays no history as rows. |
| W5 Wave-exempt kit + hook parity | complete | `YeetInboxWaveExemptRowKind`; `yeetInboxRowLiveness` reads it; hook jq literal; a repo-cli test asserts the literal equals the kits. | Threads and comments survive a push in both readers; `base-drift` still supersedes; the parity test fails when either side drifts. |
| W6 Attribution + law text | complete | Two allowlist names; `AGENTS.md` closeout bullet; yeet skill wave/exit text and vocabulary block; `CheckOutcome.ts`/`Remediation.ts` JSDoc; ttc exit-table amendment ratified by this PR. | Registry rows from a detached monitor carry harness and session id; docs describe the shipped behaviour. |
| W7 Socket probe gate | pending | Post to `$CLAUDE_CODE_MESSAGING_SOCKET` from an in-hook child, a `&` child and a `setsid -f` child; record one accepted frame, one refusal, and which senders a bypass session delivers. | The probe record is in `explorations/pr-event-awareness/research/`; the slice-2 verdict (build W8 or close as cut) is written. |
| W8 Session-owned inbox tail | pending | Shell worker spawned by SessionStart (pid file keyed by session id), `inotifywait` on `.beep/inbox/`, one message per new P0/P1 wave, cwd outside the lane, `/proc` start-identity reap, operator-registered SessionEnd teardown. | Survives the hook timeout; delivers into a bypass session; `yeet sweep --retire` succeeds with the tail running; proxy-session delivery; fleet census recorded. |
| W9 pr-wave notifier + liveness rule | pending | Monitor-side no-live-owner check (unknown = dead) spawns the notifier with the wave descriptor; notify-send + ntfy; resolves on the row's ack; own ledger namespace. | A dead-owner wave produces a desktop and ntfy notification carrying `yeet resume <pr>` locally; `sequence-break-notifier.sh` is unchanged. |
| W10 Snapshot collapse (follow-up) | pending | Collapse whichever chain the W1 timeline blames — the watch's ten GraphQL requests or the Status chain — as one small PR. | Measured per-poll cost drops; rows unchanged. |
| P11 Verify | in-progress | Run the `SPEC.md` verification matrix per slice and capture evidence. | Tests, package verify, hook syntax, packet doctor and index checks pass or blockers are documented. |
| P12 Yeet: PR to mergeable | pending | Publish each slice through Yeet, push fixes as soon as they are finished, close every hosted gate and review thread. | `merge-ready: yes` for each required PR; zero unresolved review threads. |
| P13 Close | pending | Record closeout evidence and the reflection, then flip packet lifecycle. | A schema-valid reflection exists and packet status/evidence match the shipped result. |

## First vertical slice: W1 + W2 (proven on the slice-1 PR itself)

Keep W1 and W2 joined until the attended flow works end to end on the
producer PR's own babysit:

1. Widen the check request and the status snapshot (W1) so a
   `--until-ready` capsule has bucket, state, link, workflow and timestamps.
2. Extract `Converge.ts` and call it from the merge loop every poll (W2);
   make `required-red` and the conflict non-terminal under `--until-ready`.
3. Add the `wave` outcome to `ProofJobLauncher.wait` and exit 2 to
   `yeetMonitorExitFor`, scoped to the job's own PR; never ack the wave rows.
4. Push a synthetic required red on the PR; run
   `bun run beep yeet monitor --until-ready --detach` then
   `bun run beep yeet job wait <jobId>`; confirm exit 2, a live
   `check-failed` row with a working link injected at the next tool call,
   the wave pinned to the head, the fix push superseding it, and
   `job wait` re-run reaching `ready` exit 0.
5. Print the push → row → ack timeline for that head from the new stamps;
   that figure is the first W1 measurement and the input to W10 and to the
   receiver gate in the exploration's `MAP.md`.

Then land W3-W6 in the same PR.

## Slice 2: W7 then W8

- W7 first, no tail code before it. A failed probe closes the slice: record
  the result, mark W8 `skipped` in the manifest with the reason, and move to
  W9. Idle-owner wake then stays hook injection at the next tool call plus
  the desktop `set_monitor` switch.
- W8 acceptance runs in this order: survives the SessionStart 2 s timeout;
  a message from the surviving tail is delivered, not held, into a bypass
  session; `bun run beep yeet sweep --retire` still succeeds with the tail
  running from the lane's session; then proxy-session delivery; then the
  fleet census (one tail per live session, none orphaned after session
  death).

## Slice 3: W9

- The check and the spawn live in the monitor (the systemd unit is the only
  process that knows there is no live owner). Transports from a unit are
  notify-send and ntfy; OSC 777 is terminal-only and out of this path.
- `isClaudeSessionLive` is Claude-only, so every Codex-attributed owner
  escalates until the resume-footer Codex live guard ships; record that in
  the ledger, do not suppress it.

## P11 verification

```sh
bunx --bun vitest run packages/tooling/tool/cli/test/yeet-status-triage.test.ts packages/tooling/tool/cli/test/proof-job.test.ts
bun run beep quality package-verify @beep/repo-cli
bash -n .claude/hooks/yeet-inbox.sh
test "$(wc -m < goals/yeet-pr-events/GOAL.md)" -le 4000
jq . goals/yeet-pr-events/ops/manifest.json
bun run beep goals doctor
bun run beep goals index --check
git diff --check -- goals/yeet-pr-events goals/INDEX.md
```

Attach the slice-1 babysit transcript (job id, exit codes, the injected row,
the timeline), the W7 probe record, the W8 retire-fence and census evidence,
and the W9 ledger sample under `history/`.

## P13 closeout checklist

Before changing lifecycle to `completed-retained`:

1. Drive every required PR to `merge-ready: yes` through `/yeet` and resolve
   every review thread.
2. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`, starting
   from `history/reflections/_TEMPLATE.md`.
3. Run `bun run beep lint reflection-artifacts`.
4. Update `README.md`, this plan, and `ops/manifest.json` in the same closeout
   PR so the phase and lifecycle state agree.

## Current blockers

None.
