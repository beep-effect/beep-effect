# P1 instrument: live verification and session handoff

Date: 2026-08-06
Status: instrument shipped and live; both pre-baseline gates closed same day
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

## The last check: closed 2026-08-06

**`plan-approval` is now observed in production.** Captured deliberately at
13:10:06Z by writing this session's own plan in plan mode and having the operator
approve it. The bracket is complete and matches the amended design exactly:

| Event | ts | `toolUseId` | `waitReason` | `permissionMode` |
| --- | --- | --- | --- | --- |
| `PreToolUse` | 13:10:06.132Z | `toolu_015GXU9UDRYhVBxRmB8NrJDN` | `none` | `plan` |
| `PermissionRequest` | 13:10:06.150Z | *(absent)* | **`plan-approval`** | `plan` |
| `PostToolUse` | 13:10:19.086Z | `toolu_015GXU9UDRYhVBxRmB8NrJDN` | `none` | `bypassPermissions` |

True wait, per amendment 3: `13:10:19.086 − 13:10:06.150 − 1ms` = **12.935s**.

This validates three amendments against real production rows at once.
Amendment 2's derivation (`ExitPlanMode` ⇒ `plan-approval`) fires. Amendment 4's
premise holds literally — `PermissionRequest` carries **no** `tool_use_id`, so
the two-hop join through the nearest preceding unpaired `PreToolUse` is the only
way to reach the closing event, and it resolves cleanly here. Amendment 3's
execution subtraction is computable, though at `durationMs: 1` it is immaterial
for this tool specifically.

**New finding: `permissionMode` is not stable across a bracket.** The opening two
events report `plan`; the closing `PostToolUse` reports `bypassPermissions`,
because approving the plan exits plan mode before the tool completes. Any
stratification on permission mode must therefore key on the **`PermissionRequest`
row**, never on the terminal event — keying on the terminal event would file
every plan approval under the session's ambient mode and make the headline wait
class statistically invisible. This is a genuine measurement hazard that only
appears once a real approval is captured.

Caveat on generality: this is one approval, answered in ~13 seconds, under an
ambient `bypassPermissions` session. It proves the event fires and the bracket
closes; it says nothing yet about the p95 tail. That is what the baseline is for.

## Operator salt: decided and cut over 2026-08-06

**Decision: salt the corpus.** `BEEP_AI_METRICS_HASH_SALT` is now provisioned in
the `env` block of the operator's `~/.claude/settings.json`, sourced once from
`op://TBK/ai-metrics/hash-salt`. The ai-metrics rung was chosen over
`BEEP_HOOK_PULSE_HASH_SALT` so hook rows share a pseudonym namespace with the
rest of the stack, which is what P4 reconciliation will need.

The deciding argument was not the strength of the hash but **where the rows go**:
this repository is public and the packet commits ledgers under
`history/evidence/`. The default salt is a constant published in the same
repository as the digests, so any committed row lets a reader recover `cwd` and
`transcriptPath` by hashing a guessed list of clone paths. `sessionId` is a v4
UUID and was never exposed either way. Salting is therefore a publication
requirement, not a hardening nicety.

**Cutover is sharp and global: `2026-08-06T13:12:20Z`.** Bucketing every row by
10s and classifying each `cwd` against both salts shows 100% default-namespace
before that second and 100% operator-namespace after 13:12:30Z, across *all*
concurrently running sessions on the workstation — 50-80 rows per 10s bucket,
not just the session that made the change.

**Load-bearing operational finding: settings `env` reaches hook subprocesses
immediately, with no session restart.** This was assumed in the plan and could
have failed silently — a week of collection on the default salt would have looked
identical to success. It was verified by recomputing the expected digest
independently and watching it appear in the live stream within one tool call.

Two consequences for anyone reading the corpus:

- The ~1,700 pre-cutover rows are **day-1 verification data, not baseline data**,
  and are not joinable with baseline rows. Do not migrate or re-hash them; the
  namespace boundary is the timestamp above.
- Never commit a confirmed path→digest pair to this repo. Publishing "clone X
  hashes to Y" re-identifies every row for that clone and undoes the cutover. The
  verification recipe below recomputes from the live salt instead of quoting a
  digest, deliberately.

Known divergence, unchanged and now *active*: `privateReference` in
`hook-pulse.ts` calls `hashPrivateIdentifier(value, undefined)` unconditionally,
so the codec still hashes with the default. Writer rows arrive already 64-hex and
pass through untouched, and nothing outside `hook-pulse.ts` consumes the codec's
raw-event path today, so this is latent for the baseline. It must be resolved
before P4 replay reconciles v2 wait spans against this ledger.

## Sampling power: a day-1 risk to the baseline's value

Measured over the full v1 production corpus at 14:18Z — 6,106 rows spanning
`12:13:31Z`–`14:18:47Z`, 22 distinct sessions:

| Fact | Value |
| --- | --- |
| Sessions reporting `bypassPermissions` | 20 of 22 |
| Sessions reporting `plan` | 1 (the induced approval below) |
| `plan-approval` rows | 1, **deliberately induced** |
| Organic `plan-approval` rows | **0** |
| `tool-permission` rows | 5, **all** `AskUserQuestion` |

**The one `plan-approval` sample is synthetic.** It was produced on purpose to
close the gate, so it proves the instrument fires and contributes *nothing* to
rate estimation. No organically-occurring plan approval has been observed.

**Under `bypassPermissions`, ordinary tool gates emit no `PermissionRequest` at
all.** That is why every organic `tool-permission` row is `AskUserQuestion` — the
one tool that asks the human regardless of mode. So in this operator's normal
configuration the instrument can observe exactly two things: plan approvals and
`AskUserQuestion`. The broad permission-gate population is absent **by
construction, not by chance**, and no amount of collection time will surface it
while sessions run in bypass mode.

Two consequences the baseline cannot fix by running longer:

1. The corpus measures a much narrower slice than "agent waits". Any p95 derived
   from it is a p95 *of plan approvals and AskUserQuestion*, and must be labelled
   that way rather than compared directly against the audit's headline figure.
2. The audit's p95 105-minute number came from a different source. Nothing has
   yet reconciled the two, so it remains an unvalidated import into this packet.

**Mid-week checkpoint, 2026-08-09.** If organic `plan-approval` count is still at
or near zero, the week will not be able to estimate a plan-approval p95, and the
choice is an extended window, a deliberate change in how often plan mode is used,
or reconciling against whatever produced the original 105-minute figure. Deciding
that on day 3 is cheap; discovering it on day 7 wastes the week.

## Baseline: open

Both pre-baseline gates closed on 2026-08-06, so the ~1 week log-only baseline is
**open as of `2026-08-06T13:12:30Z`** — the first bucket entirely in the operator
salt namespace. Target close: on or after `2026-08-13T13:12:30Z`.

`notifierRev` stays `log-only-0` for the whole window. Notifications, the
escalation ladder, and the P8 paired trial all remain gated on this baseline;
turning any of them on mid-window destroys it, because `notifierRev` is a
stratification variable and not the treatment.

This is wall-clock, not work. The correct action for the next seven days is to
leave the instrument alone.

Remaining, and safe to do in parallel:

1. P0 storage cutover, by a separate actor, per PLAN.md.
2. Resolve the `privateReference` salt divergence before P4 replay (above). Not
   urgent, but it is now a real inconsistency rather than a hypothetical one.

Do **not** re-run the plan-approval check to "get more samples" — the baseline
collects those naturally, and a deliberately fast approval is not a sample of the
p95 tail.

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
