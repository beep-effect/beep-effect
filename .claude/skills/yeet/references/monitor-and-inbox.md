# Monitor streams, settle rule, and the checkout inbox

Read when a monitor exits for a reason you do not expect, when you consume `--watch` rows, when you resume another session's PR, or when inbox rows wake you. Part of the yeet skill.

## Resume and stream commands

- Resume the newest publishing agent recorded for a pull request:

```bash
bun run beep yeet resume 950
```

Pass `--list` to inspect every local agent, `--agent <n>` to select a newest-first
entry, `--print` to inspect the local harness command, and `--force` only when a
matching live Claude session should be forked deliberately. `--print` exposes
workstation-local paths and session identifiers in the terminal; never paste its
output into GitHub, a PR body, or another public surface. A workstation without a
matching registry row or Claude `pr-link` transcript exits 4 and prints the native
`claude --from-pr <n>` recovery hint.

- For stream consumers: emit one NDJSON row per PR state transition (typed `yeet-watch/v1` rows:
  check transitions, thread open/resolve, new PR comments, mergeability, head
  supersession) until the PR settles; exits non-zero on a required red, a closed
  PR, a settle timeout, or a poll error. Optional reds remain in transition rows
  and the `watch-ended.optionalFailing` count. Every observed red also appends a failure capsule —
  derived from the failing check's own record — to
  `<checkout>/.beep/inbox/failures.ndjson` (`yeet-inbox/v1`) and advances the
  wave record at `.beep/inbox/dispatch.json` (`yeet-dispatch/v1`): first red
  for a head opens the repair session, later reds queue with `headSha`+`lane`
  (check name) dedup, a new push supersedes the wave. `--until-ready` writes
  the same rows through the same convergence; see Inbox for the row kinds:

```bash
bun run beep yeet monitor --watch
```

- For stream consumers that need an event wake: the process **exits** on
  the first actionable event batch — immediately when a required check fails (the
  failure capsule is already durable when it exits, even while sibling checks
  still run), and ~20 seconds after the first new PR comment so a review bot's
  burst lands as one batch of `comment-posted` rows. Exit code 0 is a
  comment-only wake; non-zero means a required red, a closed PR, a settle
  timeout, or a poll error. Optional reds never trigger the event exit. The
  comment cursor is a durable branch-scoped watermark shared with plain
  `yeet monitor`, `status --remote`, and `closeout` (`--until-ready` and
  `--until-merged` keep their own; see Comment replay), so relaunching after
  acting loses nothing: a comment posted while no monitor was attached is the
  next session's first row. Run it as a
  blocking command and treat its exit as the signal to act:

```bash
bun run beep yeet monitor --watch --until-event
```

## Settle rule

The monitor loops read the base branch ruleset once per head. They wait for every
expected required context to report a terminal result. If an exact parent name
is absent but `<context> (<variant>)` children report, the parent is tolerated
and those children must finish. A missing parent with no children keeps waiting.
If the ruleset read fails, one warning precedes fallback to the `--required`
view. Optional reds never affect an exit code in any mode; under
`--until-ready` an optional red is still a P1 `check-failed` inbox row, but it
never hands back a wave. `--settle-timeout` defaults to
30 minutes; it applies to `--until-ready`, `--until-merged`, and `--watch`, and
it bounds registration only: the budget counts while no check has registered
or an expected context is still missing, never while a registered required
check is queued or running (that wait is GitHub's job timeout, not ours).
Gate lines name `registration`, `required-pending`, `heavy-not-admitted`,
`base-conflict`, `closeout-pending`, or `settle-timeout`, including missing and
pending contexts. `base-conflict` means the base moved under the head (GitHub
reports `CONFLICTING`/`DIRTY` and empties the check rollup): merge `origin/main`
and push; the wait never spends the budget. Under `--until-ready` it is also a
P0 `base-conflict` inbox row, and neither it nor a required red ends the loop
(see Inbox). A context once seen registered for
a head stays `pending` when one poll omits it, never `missing`. `heavy-not-admitted` is tier-2 admission (B8): the loop computes the
heavy verdict every poll from the same function CI runs (`ready-for-heavy`
label, docs-only diff) and, while the verdict is `hold` with `Heavy / *`
contexts still open, moves them from `missing`/`pending` into a `gated` census
bucket and prints
`settle: heavy-not-admitted; gated: …; admit: gh pr edit --add-label ready-for-heavy; waited …`.
Held time never counts toward `--settle-timeout`; the settle clock resets when
the verdict changes, and the label admits within one poll. `skip-satisfied`
(docs-only) settles once every lane reports a terminal outcome: `pass` when it
passed without work on a hosted runner, `skip` where a lane is still skipped.
A settled head does not time out while waiting for review closeout. The final
readiness gate line includes the head timeline and push→ready wall clock when
the push date is known. A `push→row→ack <sha7>: pushed …, red …, row …,
injected …, acked …` line follows it (`-` for a stage not reached; `injected`
is the first hook hand-off to any session), and the loop prints the same line
when it leaves a head that never reached ready.

## Inbox

The checkout inbox, `<checkout>/.beep/inbox/`, is how Yeet hands pull request
events to the session that owns them. The inbox hook
(`.claude/hooks/yeet-inbox.sh`) injects unacknowledged P0 and P1 rows into
that session at the next prompt or tool call, and P0 rows also hold Stop until
they are acknowledged or superseded. The hook stamps each row's first hand-off
to a session (`firstSeenAt` in its session file), which is the `injected`
stage of the push→row→ack line. `bun run beep yeet inbox list --unacked`
prints what is open, with each row's liveness.

Vocabulary:

- **checkout**: the repository root the inbox lives under. Rows, capsules,
  and prose about them say checkout, never lane; inside a `check-failed`
  capsule, `lane` is the failing check's name.
- **inbox row**: one `yeet-inbox/v1` line in `failures.ndjson` with a kind, a
  deterministic id, a severity (P0, P1, P2), and a capsule. It stays open
  until an ack receipt under `acks/` resolves it or a push supersedes it.
- **capsule**: a row's payload, the observed facts behind it: the pull request
  number, the head SHA, and the kind's own fields (a red check's bucket,
  state, link, and workflow; a `pr-comment` row's comment URL, author, and
  excerpt).
- **wave**: the new rows on one pull request that are in the wake set (every
  P0 row, plus P1 `review-thread` and `pr-comment` rows) and neither
  acknowledged nor superseded; `yeet job wait` returns them together with
  exit 2. A required red that comes back red on a rerun of the same head
  keeps its row id, so it is a new wave by its changed red set instead. The
  wave record, `dispatch.json` (`yeet-dispatch/v1`), pins the head those rows
  belong to and carries that head's required red set; a push re-pins it and
  supersedes the previous head's rows.
- **generation**: a `base-conflict` capsule's count of the earlier conflicts
  on its head that the monitor acked `cleared`. The row id is keyed on (pull
  request, head, generation), so a conflict that returns on the same head
  after a `cleared` ack is generation + 1: a new row and a new wave. A push
  starts the new head at generation 0. A receipt that no longer decodes also
  advances it; a row acked any other way keeps that head's conflict closed
  until a push, and the monitor says so once on stderr.
- **owner session**: the harness session that submitted the monitor and waits
  on it. A detached job forwards `CLAUDE_CODE_SESSION_ID` and
  `CODEX_THREAD_ID`, so the pull request's session registry row names that
  session's harness and id for `bun run beep yeet resume <pr>`. The woken
  owner dispatches any fix itself; Yeet launches nothing.

Dead-owner escalation (W9): a detached `--until-ready` job reads the pull
request's session registry on each new wave. When no recorded owner is live
(no row, a stale Claude session, or unknown, which counts as dead), it spawns
`.claude/hooks/yeet-pr-wave-notifier.sh` once per wave (descriptor under
`.beep/yeet/pr-wave-notifier/waves/`). The notifier sends a persistent
notify-send (critical for P0, normal for P1) whose local body carries a
one-line summary and `bun run beep yeet resume <pr>`, plus a generic ntfy post
with no pull request content, and stops when the wave's rows are acked or a
push supersedes them. A live owner gets nothing extra: the inbox hook carries
the wave. The live probe reads Claude sessions only, so every Codex-attributed
owner escalates until the resume-footer Codex live guard ships. Attached runs
never escalate; their caller receives the wave itself.

`--until-ready`, attached or detached, converges the status snapshot into rows
on every poll; `--watch` does the same for checks, threads, and drift.
`--until-merged` writes no wave rows.

| Kind | Severity | Written when | Closes on |
| --- | --- | --- | --- |
| `check-failed` | P0 required, P1 optional | a check is red on the head | the next push, or an ack |
| `base-conflict` | P0 | GitHub reports the head `CONFLICTING`/`DIRTY` (`--until-ready` only) | the next push, or the `cleared` ack the monitor writes when the same head reads mergeable again; a `CONFLICTING` read after `cleared` on the same head writes generation + 1 as a new row and wave |
| `review-thread` | P1 | a thread is unresolved or owes a follow-up | an ack only; survives pushes |
| `pr-comment` | P1 | a person's top-level comment lands after the window start (`--until-ready` only; see Comment replay) | an ack only; survives pushes |
| `base-drift` | P2 | the head is `BEHIND` its base | the next push |

`review-thread` and `pr-comment` rows are wave-exempt: a push never supersedes
them, because the thread or comment still needs its answer on the next head.
One open row is kept per thread. Acknowledge them once answered, for example
with `bun run beep yeet inbox ack <id> --thread-url <url>`. Observation rows
(`proof-job-finished`, `pr-merge-ready`) are injected too but never join a
wave.

- `job wait` returns only for rows on its own job's pull request, so two
  monitors in one checkout on different pull requests never wake each
  other's waiter. It never acknowledges the rows: the hook keeps injecting
  them and a P0 keeps holding Stop until the fix lands.
- A re-run of `job wait` on the same job skips the rows it already returned
  and waits for new rows or for the job to settle. A red that stays the same
  on the same head is not returned twice: push the fix. A rerun that comes
  back red (a new job link on the same head, a spent flake rerun or a manual
  `gh run rerun`) is a new wave, and the same row is returned again.
- Optional reds never wake a waiter. An optional red, a rate-limited Vercel
  deployment included, is a P1 `check-failed` row the hook injects, but it
  never makes a wave for `job wait` or an attached `--until-ready`.
- Rows already open count. The first `job wait` on a new job returns at once
  on any open, not superseded wake-set row on the pull request, including one
  an earlier monitor wrote.
- A P0 row reads `unknown` while `dispatch.json` is missing or unreadable, and
  it then holds Stop until an attributed ack.
- `cleared` has no operator form: only the monitor writes it, and only for a
  `base-conflict` row whose head it re-read as mergeable.

Rollout: `review-thread` rows that an earlier wave superseded read live again
under the wave-exempt rule. Clear the answered ones once: list them with
`bun run beep yeet inbox list --unacked` and acknowledge each with
`bun run beep yeet inbox ack <id> --thread-url <url>`.
