# Citation limits and process isolation contract — 2026-10-28

Scope: P0 schema-owned limits, explicit default fixture and a verified stop/
cleanup mechanism. No production engine or per-family regex safety proof is
claimed. P0 remains open; this checkpoint does not authorize P1 by itself.

## Published data boundary

The server use-case barrel now exports `CitationEngineLimits`,
`CitationEngineEffectivePolicy`, `CitationEngineLimitTightening` and
`CitationEngineAbsoluteMaxima`. The latter is one immutable registry used to
construct all upper-bound schemas. No request or operator setting can raise
these ceilings. Changing the frozen policy contract requires a reviewed
policy-version update and new proof, not an environment override.

The effective policy has version `citation-engine-policy/v1`, execution mode
`isolated-process`, and all 29 required budget fields. Counts are positive
integers. Eight deadline fields decode from finite, positive whole milliseconds
to `Duration`. Encoding preserves those values exactly; non-finite,
negative, sub-millisecond and fractional-millisecond values fail. The
`CitationEngineLimitTightening` data relation compares every requested count
and Duration against the supplied Layer policy. Requests can retain or reduce
limits; the earliest applicable deadline wins at runtime.

`defaultCitationEnginePolicy` is a lazy, schema-decoded fixture exported only
from `@beep/law-practice-use-cases/test`. It is not an ambient server default.
The eventual live Layer constructor must require its decoded effective policy
explicitly. These modules read no `Config`, `ConfigProvider` or environment
values. The production Layer and its configuration-independence test remain
implementation work.

## Frozen maxima and fixture

The following values are generated from the schema registry and decoded
fixture in `citation-policy-contract.json`. Deadline rows are encoded
milliseconds; their decoded values are `Duration`. Other rows use the unit
in their name or count distinct work items. Queue/concurrency budgets apply to
one composed Layer; other counters apply to one public operation.

| Field | Absolute ceiling | Default fixture |
| --- | ---: | ---: |
| `sourceUtf16` | 1,000,000 | 250,000 |
| `tokens` | 1,000,000 | 250,000 |
| `candidates` | 100,000 | 25,000 |
| `mentions` | 25,000 | 10,000 |
| `authorities` | 25,000 | 10,000 |
| `patterns` | 16,384 | 8,192 |
| `patternUtf16` | 8,192 | 4,096 |
| `patternEvaluations` | 1,000,000 | 250,000 |
| `patternMatches` | 250,000 | 100,000 |
| `resolutionEdges` | 1,000,000 | 100,000 |
| `resolutionIterations` | 1,000,000 | 100,000 |
| `annotationReplacements` | 25,000 | 10,000 |
| `annotationOutputUtf16` | 4,000,000 | 1,000,000 |
| `annotationGrowthUtf16` | 1,000,000 | 250,000 |
| `producedTextUtf16` | 8,000,000 | 2,000,000 |
| `diffInputUtf16` | 4,000,000 | 1,000,000 |
| `diffSteps` | 2,000,000 | 500,000 |
| `processMessageBytes` | 32,000,000 | 8,000,000 |
| `concurrentOperations` | 2 | 1 |
| `concurrentRegexProcesses` | 2 | 1 |
| `queuedOperations` | 16 | 4 |
| `cleanDeadline` | 30,000 | 10,000 |
| `extractDeadline` | 30,000 | 10,000 |
| `resolveDeadline` | 30,000 | 10,000 |
| `annotateDeadline` | 30,000 | 10,000 |
| `operationDeadline` | 60,000 | 30,000 |
| `regexDeadline` | 1,000 | 250 |
| `queueDeadline` | 5,000 | 1,000 |
| `cleanupDeadline` | 5,000 | 1,000 |

The engine source ceiling is fixed independently at one million UTF-16 units,
and the test checks that it does not exceed the public verified-span ceiling.
A future prerequisite ceiling change cannot silently raise this engine limit.
The current corpus's largest public-operation text is 85,336 UTF-16 units.
Each captured tokenizer configuration has 6,805 records; its largest pattern
is 774 or 664 UTF-16 units respectively. These fit the fixture's relevant
budgets, but these counts do not prove runtime cost or all-family compatibility.

The runtime must charge work before allocation/append/evaluation, including
failed native evaluations, raw matches later discarded, rejected candidates,
examined resolution edges and repeated produced text. Zero-width matches
must advance safely and still consume budgets. Output growth is positive
output-minus-input growth. Diff input counts both sides, and diff steps count
all attempted work. No limit may truncate a result and return success.
Count/deadline exhaustion must translate to `CitationSafetyLimitExceeded`.
The closed engine failure translators and counter enforcement are still P1/P2
implementation obligations, not provided by the schemas alone.

## Execution decision

Use a parent-owned, force-stoppable child-process boundary for native regex
execution. Rewrite and review patterns for static safety and literal routing;
process isolation remains the default containment boundary. The installed
Effect 4.0.6 `NodeWorker` adapter first allows five seconds for graceful
shutdown. That finalizer alone does not enforce a smaller regex deadline.
The production implementation must use the Effect process/worker services
with explicit ownership and force-stop behavior, rather than assuming that
an Effect timeout interrupts native JavaScript regex execution.

The required runtime sequence is:

1. Preflight source/structure/text budgets before serialization. Decode only
   closed, data-only operation messages. Neither request data nor the worker
   protocol carries executable callbacks. Named cleaner/tokenizer behavior
   remains injected server code with the same budgeting/isolation obligations.
2. Reserve bounded operation/queue/process slots. Charge registered patterns
   and routing traversal; apply reviewed literal prefilters. Charge each
   native evaluation before entering it and each raw match before storing it.
3. Keep deadlines and admission in the responsive parent under Effect `Clock`/
   `Duration`. Worker progress cannot extend a budget. A per-evaluation grant/
   response discipline must prevent buffered progress messages from postponing
   the deadline; every stage also has its own deadline and total work caps.
4. Reject oversize messages while reading/producing them, before an unbounded
   whole-message allocation. Produced-text charging complements message-byte
   limits. Closed schemas/limits apply to both sides of the boundary.
5. On expiry or cancellation, request `SIGKILL` for the exact owned child and
   await its exit before reusing its process slot. Discard late/partial replies.
   Successful replies also require scoped child cleanup before slot reuse.
6. If exit cannot be confirmed within the cleanup budget, quarantine that slot
   and stop admitting replacement work until ownership is resolved. Do not
   launch an indefinite series of replacements or touch unrelated processes.

This choice is reversible only through a new reviewed execution-policy version
and equivalent interruption/cleanup proof. It is not permission to retain
exponential patterns without review, omit deterministic caps, or mark a family
compatible before its tests pass. Python syntax, duplicate named groups,
Unicode semantics and pattern rewrites still need their own exact parity proof.

## Empirical mechanism controls

`ops/probe-regex-isolation.mjs` owns one child at a time and uses Effect
`Clock`, `Duration`, scoped acquisition/release and parent heartbeats. The
child's deliberately blocking native regex cannot block the parent's clock.
`ops/regex-isolation-probe.child.mjs` is maintainer probe code, not the
production worker or a public regex-evaluation API.

The retained `regex-process-isolation-probe.json` records Node 24.22.1 and
Bun 1.4.4, host CPU/runtime metadata, source hashes, three repetitions per
control/runtime, deadline decisions and confirmed exits. Its zero warmups
are explicit: this is a mechanism experiment, not a microbenchmark.

- Six safe-linear controls return a successful match.
- Six `^(a+)+$` controls on 40 `a` characters plus `!` hit the parent deadline.
- Every catastrophic control retains parent heartbeats and a confirmed
  `SIGKILL` exit; all twelve children have confirmed cleanup.
- A safe result may be followed by normal exit or scoped force-stop if the
  child has not exited yet. Neither leaves a reusable slot with a live child.
- The recorded 100 ms probe deadline is stricter than the 250 ms default.
  Host elapsed values are observations, not exact latency gates.
- The probe uses a two-second exit-confirmation guard. The production adapter
  must use its decoded cleanup deadline (one second in the default fixture);
  this experiment does not claim enforcement of that future adapter policy.

This does not satisfy the required geometric per-family benchmark. Every
accepted family still needs static compatibility review, literal-routing
classification, warmups/repetitions, environment metadata and the rule that
median growth may not exceed 3.5x for two consecutive input doublings. The
seeded catastrophic family must fail that lane. No family is approved by this
mechanism checkpoint.

## Reproduction and validation

```sh
bun run goals/citation-extraction-engine/ops/export-policy-contract.ts \
  "$CACHE_ROOT/citation-policy-contract.json"
bun run goals/citation-extraction-engine/ops/probe-regex-isolation.mjs \
  "$NODE_EXECUTABLE" "$BUN_EXECUTABLE" \
  "$CACHE_ROOT/regex-process-isolation-probe.json"
bun run goals/citation-extraction-engine/ops/check-safety-contract.ts
python goals/citation-extraction-engine/ops/verify-safety-controls.py \
  --scratch-root "$CACHE_ROOT"
bun run --cwd packages/law-practice/use-cases test -- \
  test/CitationEngineLimits.test.ts
bun run beep quality package-verify @beep/law-practice-use-cases
```

Both executable paths must identify the approved runtime binaries; no new
runtime install is implied. Proof refreshes retain source hashes and are
reviewed before replacing committed observations.

Observed: five focused tests cover every count/deadline boundary, rejection of
non-finite/fractional values, both Duration codec directions, every request
increase, permitted tightening, required fields and unknown modes/versions.
Full package audit/docgen pass. The portable safety checker validates exact
maxima/defaults, source hashes, the complete control matrix, successful matches,
parent responsiveness and confirmed force-stop cleanup. All fourteen actual-
validator corruption controls fail as required, including absent exit proof.
Fixed observational values use required literals rather than constructor tags
that could insert an omitted observation. The remaining fixture/proof schemas
need the same explicit-presence audit during final parity-gate integration.

## Remaining work

Implement the production budget counters, failure translation, bounded
protocol, queue/process ownership and cleanup quarantine. Complete all pattern
compatibility/geometric/adversarial reviews, integrate safety into the strict
parity command, and finish supplemental oracle probes and donor dispositions.
The policy is frozen; execution enforcement and family-level proof remain open.
