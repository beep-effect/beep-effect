# P1 sharp notifier and circuit-breaker cutover

Date: 2026-09-03
Baseline revision: `log-only-0`
Treatment revision: `desktop-ntfy-1`
Status: merged and in guarded fleet rollout, with a first treatment readout
recorded and phone delivery still open

## Preconditions

The fixed log-only window was closed before treatment. Its method, denominator,
wait distribution, and sampling decision are recorded in
`research/2026-09-03-p1-baseline-close.md`. The cutover targets the observed
`AskUserQuestion` tail; plan approval remains notifier-eligible but unmeasured.

The shared hook-pulse switch reported armed with no sentinel. All `op`, `gh`,
and `network` circuit-breaker states reported closed before rollout.

## Shipped instrument

- `SequenceBreakNotificationV1` models only timestamp, pseudonymous session,
  bounded wait/stage/transport enums, age, revision, evidence tier, and tagged
  delivery outcome. `SequenceBreakDampingV1` models the atomic per-session
  storm claim. Neither schema can represent prompts, commands, tool inputs,
  tool results, response bodies, or free-form errors.
- `.claude/hooks/sequence-break-notifier.sh` starts only after a durable
  `PermissionRequest` row. It replays the strict two-hop bracket, suppresses an
  unattributed or resolved request, atomically damps one session/target storm,
  and rechecks the exact bracket before reminder and urgent rungs.
- Desktop notifications reach the same-UID Plasma user bus even when an agent
  process lacks inherited GUI environment variables. A real `notify-send`
  cutover probe was accepted after resolving `/run/user/<uid>/bus`.
- ntfy publishing keeps the topic in JSON stdin and an optional bearer token on
  an inherited file descriptor. It probes reachability through the shared
  network breaker before publishing. No topic or token is passed in a URL,
  command argument, or ledger row.
- `CircuitBreakerEventV1` and `CircuitBreakerOpenStateV1` model the shared
  `op`, `gh`, and `network` lanes. `.claude/hooks/circuit-breaker.sh` holds a
  per-probe file lock across the guarded command. One failure atomically opens
  the machine-wide state; subsequent agent adapters return exit 75 and append
  `retry-skipped` without executing the command. An operator reset or an
  expired half-open probe is required before recovery. Coordination or state
  validation failures return exit 76 and append `coordination-skipped`, so a
  caller cannot misreport malformed or contended state as an open cooldown.
- Claude and Codex adapters share the same implementation and the same
  `${XDG_STATE_HOME:-$HOME/.local/state}/beep/agent-evidence` state.

Codex lifecycle parity is bounded by the installed `codex-cli 0.153.0` hook
contract. It exposes `PreToolUse`, `PermissionRequest`, and `PostToolUse`, but
not Claude's distinct `PostToolUseFailure` or `PermissionDenied` event names.
The live Codex census for September 1–3 contained 11,115 `PreToolUse`, 10,963
`PostToolUse`, 141 `UserPromptSubmit`, 106 `Stop`, and 63 `SessionEnd` rows, with
no permission start in that interval. Unsupported keys were not added to
`.codex/hooks.json`; a Codex permission claim closes on the terminal evidence
that its harness actually emits or is conservatively resolved at session end.

The guarded command form is:

```sh
.claude/hooks/circuit-breaker.sh run op codex-cli -- op <safe arguments>
.claude/hooks/circuit-breaker.sh run gh codex-cli -- gh <safe arguments>
.claude/hooks/circuit-breaker.sh run network hook -- curl <probe arguments>
.claude/hooks/circuit-breaker.sh status
.claude/hooks/circuit-breaker.sh reset op operator
```

The wrapper passes command output and exit status to its caller but never writes
the command, arguments, output, or error to breaker state.

The implementation checkout also dogfooded the wrapper for its live
`git fetch origin main --quiet` refresh. The resulting
`2026-09-03T10:03:21.678Z` row was exactly the seven-field
`circuit-breaker-event/v1` allowlist, reported
`network` / `codex-cli` / `probe-succeeded`, and decoded through
`CircuitBreakerEventV1`; no command or remote detail entered the row.

## Verification

Focused package proof:

```text
bunx --bun vitest run test/hook-pulse-writer.test.ts \
  test/sequence-break.test.ts test/circuit-breaker.test.ts

Test Files  3 passed (3)
Tests       76 passed (76)
```

The conformance cases prove:

- real writer-to-notifier launch after the permission row is durable;
- one desktop send plus an explicitly unconfigured phone transport;
- duplicate suppression as two `storm-damped` decisions;
- exact `PostToolUse` closure as two `bracket-resolved` decisions;
- configured ntfy publishing consults the network breaker and retains neither
  the topic nor transport body in either ledger;
- topic and bearer-token configuration is removed from the environment before
  either reachability or delivery curl processes start;
- a kill switch raised during the reachability probe suppresses the subsequent
  phone POST at the transport boundary;
- one breaker failure, a cross-adapter retry skip that does not execute, an
  explicit reset, and successful recovery;
- malformed open state refuses the command rather than guessing;
- a disarmed worker creates neither delivery evidence nor damping state;
- every produced notification, damping, breaker-event, and open-state document
  decodes against its owning schema and contains none of the content canaries.

Shell syntax, package source typechecking, JSON configuration parsing, and
`git diff --check` also passed. The exact P0 repair capsule,
`bun run beep quality github-checks cheap-gates --collect-all`, passed all 14
lanes, including repo-wide test tsgo across 995 files and 138 packages,
Effect-import governance with zero touched files, and schema-first with zero
arbitrary-test advisories. `bun run docgen:local` selected
`@beep/repo-ai-metrics` and its dependency-expanded `@beep/infra` and
`@beep/repo-cli` set; all three completed, and ai-metrics typechecked 339
examples. The local environment does not currently expose `shellcheck`, so no
shellcheck claim is made.

## Interrupted-series boundary

Every hook command configured in this checkout now explicitly stamps
`desktop-ntfy-1`, and the writer fallback carries the same revision so an
already-running host does not remain on its cached `log-only-0` command.

The first sharp live row was a Codex `PostToolUse` at
`2026-09-03T09:41:26.700Z`. Hook processes already in flight under the old
script finished through `2026-09-03T09:41:32.485Z`. The first new sharp
`PreToolUse` after that overlap was `2026-09-03T09:41:33.322Z`; analysis must
exclude the six-second transition interval and use that latter timestamp as the
post-intervention lower bound. The next sampled live rows were uniformly
`desktop-ntfy-1`.

This is not yet a fleet-wide flip. At `2026-09-03T09:46:37.283Z`, a live census
of rows at or after the lower bound found 423 rows: 46 `desktop-ntfy-1` and 377
`log-only-0`, with zero `PermissionRequest` starts. The latter rows came from
sibling checkouts that do not contain this unmerged branch. They remain a
revision-labeled comparison population; they must receive the change through
the required PR lifecycle, not by dirtying their worktrees out of band.

A follow-up census at `2026-09-03T11:08:44Z` found 5,898 post-boundary rows:
417 `desktop-ntfy-1` and 5,481 `log-only-0`. One `AskUserQuestion`
`PermissionRequest` had accrued, but it was in the `log-only-0` comparison
population; the sharp treatment denominator remained zero. The notification
ledger still contained zero files, and the current process exposed neither an
ntfy topic nor a bearer token. This increases observation time but
does not satisfy either open evidence gate.

## Post-merge guarded rollout

PR #973 merged at `2026-09-03T14:32:50Z` as `e60fe8ff66`; fresh `origin/main`
was `a1652c1923` after the immediately following mainline merges. The read-only
fleet mirror discovered 22 same-origin clones and 103 total clone/worktree
checkouts, with 2 degraded checkouts. That denominator is much wider than the
set safe to mutate automatically.

Two direct clones already carried `desktop-ntfy-1`. Five more direct clones
were on clean, process-idle `main` worktrees, so each was fetched through the
shared network circuit breaker and fast-forwarded to `a1652c1923`. Their
post-merge hooks passed the version-sync check. The seven adopted direct clones
each expose all nine Claude and six Codex `desktop-ntfy-1` command stamps.
Active, dirty, detached, and feature-branch checkouts were left untouched;
their rows remain valid revision-labeled controls rather than being silently
reclassified at merge time.

By `2026-09-03T14:53:43.103Z`, subsequent owner integrations had raised the
direct-clone adoption count to 17 of 22. The five non-adopters were one archived
Effect-v3 clone, two active dirty feature branches, one active clean feature
branch, and one idle clean feature branch owned by another workstream. None was
mutated by this rollout. They remain explicit controls pending a safe owned
integration point or an evidence-backed exclusion.

At `2026-09-03T17:12:07.940Z`, another read-only fleet scan found 22 direct
clones and 101 total checkouts, with one degraded checkout. Owner integrations
had raised sharp adoption to 19 of 22. The three non-adopters were the archived
Effect-v3 clone, one live dirty feature checkout whose PR remained open, and
one clean inactive feature checkout with no associated PR in the exact branch
query or observed liveness signal. These three are explicitly excluded
from the current rollout denominator: the archive is outside the current
runtime population, and out-of-band changes to the two feature checkouts would
violate worktree ownership. Their revision-labelled rows remain controls. The
disposition must be revisited if either feature checkout integrates or
reactivates. No other worktree was mutated.

At `2026-09-03T14:38:50.654Z`, the post-boundary ledger held 15,501 rows:
1,423 `desktop-ntfy-1` and 14,078 `log-only-0`. The only
`AskUserQuestion` `PermissionRequest` was still `log-only-0`, so the sharp
human-input denominator remained zero. The canonical allowlist scan found zero
rows with forbidden content keys. The instrument was armed, the notification
ledger held zero files and zero rows, and the ntfy base URL, topic, and token
were all absent from the runtime environment.

A later `2026-09-03T14:50:35.999Z` census held 16,649 rows: 2,361 sharp and
14,288 comparison. The same single comparison-population request remained the
only `AskUserQuestion` start; the sharp denominator and notification ledger
both remained zero.

The packet launcher-size, manifest JSON, packet whitespace, goals-doctor, and
reflection-lint checks passed after the record was updated. `goals index
--check` remained red on an unrelated generated-index drift already present at
clean `main` `a1652c1923`; a second clean clone reproduced the same failure.
This change did not rewrite `goals/INDEX.md` or absorb that separate repair.

After integrating fresh `main`, the scheduler-independent local proof ran each
`@beep/repo-ai-metrics` lane with `--filter`: lint and typecheck passed, all 304
tests passed, branch coverage held at 371/475 (78.10%), and the 27-file build
passed. This re-proves the instrument against the integrated tree without
claiming entry into the canonical scheduled Yeet lane.

## First sharp treatment readout

At `2026-09-03T17:04:13.599Z`, the post-boundary ledger held 17,735 rows:
3,298 `desktop-ntfy-1` and 14,437 `log-only-0`. Eight sharp
`AskUserQuestion` starts had accrued. The strict two-hop matcher closed seven
on exact-ID `PostToolUse`, tombstoned one at `SessionEnd`, and guessed or
ambiguously attributed none. Closed waits were 4.435–27.430 s with p50 7.439 s,
30.025 s / 80.1% below the fixed baseline median. Because the treatment
denominator is small and its permission-mode mix differs from baseline, this is
a favorable early descriptive estimate, not an unqualified causal claim.

The notification ledger held 18 valid rows across all eight sharp request
timestamps. Two initial desktop sends were accepted, six retries were
storm-damped per session/target, and a reminder pair was skipped after exact
replay found the originating bracket resolved. The two eligible ntfy attempts
were `transport-unconfigured`; no phone-delivery claim is made. Full method,
mode strata, durations, and privacy checks are in
`research/2026-09-03-p1-first-treatment-readout.md`.

## Remaining P1 gate

P1 stays `in-progress` for one evidence reason:

1. Desktop delivery is live, but phone delivery is not configured. The session
   had no 1Password Environments MCP tool. The permitted agent credential check
   ran `op-doctor` once and stopped on `FAIL UUID op read: could not resolve a
   non-empty field`; no inventory, secret, or reference was printed or written.
   The notifier records ntfy as `transport-unconfigured` until a secret topic is
   safely injected at runtime.

The limitation is not converted into guessed evidence. P2 remains gated until
the phone-delivery receipt is real.
