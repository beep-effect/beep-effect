# P1 instrument: live verification and session handoff

Date: 2026-08-06
Status: instrument shipped and live; baseline not yet started deliberately
Predecessor: `2026-08-01-p1-hook-semantics-spike.md`

## What shipped

PR #582 (merged 2026-08-06, squash `e9a1fadb9`). PR #570 was superseded and
closed — it proved the CI fix but had inherited a commitlint violation from
main through a reconciliation merge; see "Traps worth not re-learning" below.

- `.claude/hooks/hook-pulse.sh` — appends one privacy-safe `HookPulseV1` NDJSON
  row per hook event to `${XDG_STATE_HOME:-$HOME/.local/state}/beep/agent-evidence/hook-events/`.
  Nine events registered in `.claude/settings.json`.
- `.claude/hooks/hook-pulse-switch.sh` — `arm` / `disarm` / `status` kill switch
  with an explicit disarm-window ledger.
- `HookPulseEvent` gained `PostToolUseFailure`; `HookPulseV1` gained an
  event-owned `isInterrupt`; `sessionId` / `cwd` / `transcriptPath` are
  `Sha256Hex` per the PR #559 privacy remediation.
- 139 tests, including a conformance suite that spawns the real script and
  decodes its output with `HookPulseV1`.

`notifierRev` is `log-only-0`: **notifications are off by design**. This ships
the instrument, not a treatment.

## Day-1 verification against live production rows

Measured 2026-08-06 over **1,329 rows across 10 session shards**, harness
2.1.223. This closes the three checks the packet README listed as open.

| Event | Rows | Verdict |
| --- | --- | --- |
| `PreToolUse` | 637 | fires |
| `PostToolUse` | 632 | fires, carries `durationMs` |
| `Notification` | 18 | fires |
| `UserPromptSubmit` | 17 | fires |
| `Stop` | 16 | fires |
| `PostToolUseFailure` | 5 | **fires — amendment 8 validated, the gate is enabled here** |
| `PermissionRequest` | 4 | **fires — the wait-start marker works in production** |
| `PermissionDenied` | 0 | not yet observed, consistent with 2.1.220 |
| `SessionEnd` | 0 | not yet observed (sessions still open) |

`waitReason`: 1307 `none`, 14 `idle-input`, 4 `tool-permission`, 4 `unknown`.

Schema conformance is clean: every row decodes, identifiers are 64-hex,
`evidenceTier` is uniformly `derived` (the weakest-link clamp holding), and
`durationMs` is present on `PostToolUse`, so amendment 3's execution-subtraction
is computable on real data.

**Amendment 8 refinement.** A `Bash` command exiting non-zero produces a normal
`PostToolUse` (measured: exit 42 → `PostToolUse`, `durationMs: 27`), not
`PostToolUseFailure`. A failing *command* is a successful *tool call*. The
failure event is real and does fire — 5 rows — but for genuine tool errors, not
command exit codes. Bracket-closing for ordinary failing shell commands is
therefore unaffected.

## The one check still open

**`plan-approval` has never been observed.** All 4 `PermissionRequest` rows are
`AskUserQuestion` → `tool-permission`. No `ExitPlanMode` approval has been
captured, and that is the headline wait class — the p95 105-minute figure this
whole packet exists to reduce.

Do not start the week-long baseline until one `ExitPlanMode` approval has been
observed end to end. Ten minutes of deliberate verification de-risks seven days
of collection. Expected shape: a `PermissionRequest` row with
`toolName: "ExitPlanMode"` and `waitReason: "plan-approval"`, closed by a
`PostToolUse` bearing the same `toolUseId`.

## Decision required before the baseline accrues

**Operator salt.** `sessionId` / `cwd` / `transcriptPath` are hashed with
`hashPrivateIdentifier`, whose salt defaults to the public constant
`beep-ai-metrics-local-smoke-insecure-salt`. Against guessable filesystem paths
that is weak protection. Rows hashed under the default **cannot be strengthened
retroactively**, so this is a now-or-never call for the baseline corpus.

Known divergence, documented in `hook-pulse.sh`: every other ai-metrics producer
threads an operator salt (`forwarder.ts` provisions `BEEP_AI_METRICS_HASH_SALT`
from 1Password), but `privateReference` in `hook-pulse.ts` hashes with the
default unconditionally to keep that schema transform pure. On a salted machine,
writer rows and codec-migrated rows land in different pseudonym namespaces.

## Next steps, in order

1. Observe one `ExitPlanMode` plan approval end to end (above).
2. Decide the operator salt (above).
3. Start the ~1 week log-only baseline. It is wall-clock, not work — everything
   downstream (notifications, escalation ladder, the P8 paired trial) is gated
   on having it.
4. While it accrues: P0 storage cutover may proceed in parallel by a separate
   actor, per PLAN.md.

## Traps worth not re-learning

- **`yeet verify` runs each package's `test` script, never its `coverage`
  script, and they are different runtimes.** A fully green 21-lane local proof
  cannot catch a coverage-runtime defect. `Bun.spawn*` does not deliver stdin in
  a vitest worker under coverage — measured, `cat` echoed empty for TypedArray,
  `spawnSync`, and `Bun.file` alike. Spawn through `ChildProcess` from
  `effect/unstable/process`.
- **In jq, absence of output is not absence of success.** This bit three times
  in one PR: `capture()` on no-match, `def f($a)` desugaring to an iterating
  binding, and `//` over an empty file. Default in shell, where an empty string
  is observable.
- **Reconciling a diverged pushed branch with `-s ours` moves the merge-base
  backward** and drags foreign history into the PR's review surface. Tree
  identity and fast-forwardability both pass while this happens. Compare
  `gh pr view N --json commits | length` against
  `git rev-list --count origin/main..HEAD`; prefer a fresh branch.
- **Test-then-act on a shared path is the whole bug class** in the kill switch —
  four Greptile P1s, one mistake in four places. It now publishes with `ln`,
  takes with `rename`, and commits-or-rolls-back.
- Task-notification exit codes report the *pipeline's* status. Write the real
  code into the log: `cmd > /tmp/x.log 2>&1; echo "EXIT: $?" >> /tmp/x.log`.
