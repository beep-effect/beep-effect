# P1 sharp notifier and circuit-breaker cutover

Date: 2026-09-03
Baseline revision: `log-only-0`
Treatment revision: `desktop-ntfy-1`
Status: live in this checkout, with fleet rollout, post-intervention sampling,
and phone delivery still open

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
  expired half-open probe is required before recovery.
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
Tests       75 passed (75)
```

The conformance cases prove:

- real writer-to-notifier launch after the permission row is durable;
- one desktop send plus an explicitly unconfigured phone transport;
- duplicate suppression as two `storm-damped` decisions;
- exact `PostToolUse` closure as two `bracket-resolved` decisions;
- configured ntfy publishing consults the network breaker and retains neither
  the topic nor transport body in either ledger;
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

## Remaining P1 gates

P1 stays `in-progress` for two evidence reasons:

1. No post-cutover `AskUserQuestion` bracket has accrued yet, so the first wait
   reduction and interrupted time-series estimate do not exist yet. The tracked
   cutover is live only in this checkout until it ships through the PR gate.
2. Desktop delivery is live, but phone delivery is not configured. The session
   had no 1Password Environments MCP tool. The permitted agent credential check
   ran `op-doctor` once and stopped on `FAIL UUID op read: could not resolve a
   non-empty field`; no inventory, secret, or reference was printed or written.
   The notifier records ntfy as `transport-unconfigured` until a secret topic is
   safely injected at runtime.

Neither limitation is converted into guessed evidence. P2 remains gated until
P1's post-intervention denominator and phone-delivery receipt are real.
