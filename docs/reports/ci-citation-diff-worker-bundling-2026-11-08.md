# Citation diff worker bundling qualification

The Bun diff test fixture now prepares its trusted entrypoint through the existing
`makeCitationBundledTestRuntime` helper. Each installation owns its bundle and
temporary directory; every request still launches a separate native child. The
Node branch continues to use the same trusted Node entrypoint and bundle settings.
There is no global bundle cache, mutable-state reuse or production source change.

The change preserves the current `useDmp` argument, malformed-runtime and Unicode
refusal controls, all original map cases, configured deadlines, independent exit
acknowledgment and zero-active/queued/quarantined-owner assertions. Two added
runtime controls verify the actual executable kind with an empty child environment
and distinct nested scoped outputs whose cleanup cannot delete another owner.

## Pre-existing failure and hypothesis

A retained main integration log confirms a pre-existing failure: the Bun test
`compares all 1005 source maps through bun with independent exit acknowledgement`
exceeded its 599,750 ms watchdog. The file reported one failure among two tests:
Bun failed after 599,777 ms; Node passed after 145,864 ms. The exact command was
`bunx --bun vitest run test/integration --passWithNoTests`, so this was a Bun-hosted
runner, independently of the runtime descriptor's label. The complete job later
hit its overall 90-minute limit. [Comparable main job](https://github.com/beep-effect/beep-effect/actions/runs/42444900312/job/128622685864).

That observation does not by itself establish cold TypeScript loading as the
cause. The source suggested a measurable hypothesis: Bun launched the raw
TypeScript/platform/Effect entry chain for each map, while Node already launched
a prepared bundle. The smaller matched workload below qualifies that hypothesis
locally; the historical hosted failure is not a successful timing baseline.

There is a separate runtime-selection issue under an actual Node-hosted runner:
the former Bun descriptor used `process.execPath`, which identifies the Node
host. The shared helper resolves an actual Bun executable instead. Performance
comparison therefore uses actual Bun in both variants; a mislabeled Node launch
is never counted as Bun performance evidence.

## Fixed workload and runtime identity

The comparison starts from merge `32eb4b5f130`, preserving the earlier fixture
candidate `19e4eea2a92` and incorporating only landed main
`8b09903d4512454490c4cd0039588ca665d7b095`. The unlanded main unblocker was not
used as a base. The existing old dirty fixture checkout was preserved untouched;
this change was reconstructed from the current owner and shared helper.

The fixed sample uses the existing eight-map selection: original indices 0–3 and
1001–1004 of the authenticated 1,005-map corpus. Each variant authenticates and
decodes the complete corpus, installs a fresh worker, evaluates every selected
map, checks exact expected edit steps, independently confirms all eight child
exits and checks zero remaining physical/admission owners.

Both variants run under Bun-hosted Vitest 5.1.0, Bun 1.4.4, one Vitest worker and
a scope capped at two CPUs and 8 GiB. The measured spawn commands are captured
from the real process-spawner boundary, rather than inferred from a descriptor.
Both variants select the same Bun native binary; querying that binary outside
the timed boundary returns `bun:1.4.4`. All encoded step outputs compare equal
across all samples. A separate Node 24.22.1-hosted probe also captures eight real
Bun child launches and confirms the child version is Bun 1.4.4.

Each variant runs in a separate frozen test process. One warmup per variant
precedes three alternating pairs; no sample is discarded. Only the fixture's
runtime preparation changes between variants. Candidate source is restored
byte-for-byte afterward. No Turbo result reuse or custom tracer participates in
the paired measurements. Process-local module/bundler state starts afresh;
filesystem and operating-system caches remain shared.

The inside clock includes complete corpus authentication, setup/bundling, all
eight requests and assertions, independent retirement, and scoped cleanup. It
excludes outer Vitest/test-layer initialization, runtime-version probes and
receipt writing. Separate process wall times are retained. These custom
measurement scopes cap resources; they are not scheduler-admission receipts.
Canonical package quality commands retain normal internal admission.

## Local paired observation

| Pair | Order | Raw Bun entrypoint, ms | Scoped Bun bundle, ms |
| --- | --- | ---: | ---: |
| 1 | Raw, bundle | 5,055.305 | 1,571.754 |
| 2 | Bundle, raw | 4,931.774 | 707.565 |
| 3 | Raw, bundle | 4,619.959 | 927.203 |
| Median | | 4,931.774 | 927.203 |

Every paired bundled workload is lower. The median is 81.20% lower for this
fixed local eight-map workload. The first bundled pair has a substantially
higher setup observation than the later pairs; it remains included.

| Phase median | Raw entrypoint, ms | Scoped bundle, ms |
| --- | ---: | ---: |
| Corpus authentication and policy | 30.013 | 30.295 |
| Fresh fixture preparation | 6.973 | 94.219 |
| Eight requests and retirement assertions | 4,881.396 | 618.608 |
| Scoped finalization | 0.720 | 0.652 |

Phase medians need not sum to the total median. Bundling adds preparation cost
and removes repeated child-loading work; setup-only consumers still pay that
new preparation cost. No claim follows about whole-job percentage improvement,
Node performance, peak RSS, statistical confidence or a different runtime version.
Selected-span diagnostics separately observe zero versus one bundle preparation
and eight native starts/eight retirement completions. Their timings are not used
for the clock-only percentage above.

## Full-corpus and functional proof

The original complete Bun integration test passes locally in a 79.58-second
Vitest run under a two-CPU/12-GiB cap. It retains all 1,005 maps, exact expected
steps, 1,005 spawned/independently confirmed exits, and zero active, queued,
quarantined or physical owners. Its existing 600,000 ms test deadline is
unchanged. An outer 640-second command bound is only a cleanup guard. The Node
case is explicitly unselected in this Bun-only qualification; the original test
file and both cases remain intact.

The focused DiffWorker and input-admission files pass all 15 tests under each
of Bun, actual Node 24.22.1, and cached CI-version Node 22.23.4. The Node 22 run
prepends its executable directory to PATH and uses the existing Float16Array
flag. These are runtime/test results, not coverage reports. Existing success,
limits, deadlines, cancellation, quarantine, malformed-runtime and Unicode
controls remain enabled alongside the two new scope/runtime controls.

Affected SourceDocument, DocumentExtraction and HtmlGeometryPreparation tests
pass three files/nine tests in 92.38 seconds, covering both native worker kinds,
real downstream document maps/queries, source extraction, quota refusal and
retirement. The whole Node 1,005-map corpus, full server audit and hosted checks
are not established by these local runs. Hosted same-scope integration remains
required before declaring the historical watchdog or entire CI lane fixed.

Private receipts retain exact probes, all warmup/paired outputs, source hashes,
actual spawn/runtime identities, process times, restoration copies and full logs
under `.beep/diff-runtime-perf/`. Package-scoped quick verification passes lint in 9.3 seconds and check in
8.8 seconds, including upstream build closure and package test TypeScript checks.
`docgen:local` passes as a no-op because no package source docgen inputs changed;
this is not full docgen proof. The full package audit remains deferred to the
coordinated quality/publication sequence.
