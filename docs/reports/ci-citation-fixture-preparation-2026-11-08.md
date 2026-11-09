# Citation fixture preparation and bounded integration profiles

The source-document and canonical extraction test fixtures can prepare fresh
production owners without first constructing unused replay corpora and stages.
This change reuses that smaller preparation path in source-document tests and in
the canonical extraction/public-engine replay fixture owners. Other callers keep
the complete replay fixture. Production extraction, deadlines, coverage floors,
corpus membership, test counts and child-process isolation are unchanged.

This is a bounded fixture improvement. It does not establish a reduction in the
51m47s integration job observed on PR #2925, or in a complete integration suite.

## Implementation and retained invariants

The document fixture separates caller-scoped runtime/service preparation from its
replay-stage construction. Both default installers call the same production
installer with the existing canonical asset-path helper. The smaller installer
retains fresh clocks, operation/native admissions, budgets, observations, cleaner
owners, frozen-edition owners, temporary directories and runtime descriptors.
It omits unused corpus loading, binding translation, replay stages, an extra
parser/helper preparation and unused optional geometry preparation.

Canonical extraction and the shared public-engine replay use the smaller
installer. Their engine-layer and canonical-attribute helpers accept only the
fixture capabilities they consume. The actual production default layer still
installs its own fresh services. Both default configuration installations remain;
this change does not reuse mutable layer state.

The earlier regex-descriptor reuse already exists on the base and is not repeated.
No bundle cache or wider file sharding is introduced. Measured bundle preparation
is a small part of these first-row workloads; duplicate bundles alone would not
justify a cache with new invalidation/lifetime responsibilities.

## Measurement boundary

The base is `f96cda54226b209ded0b1c4212c1101fa7e72443`. Measurements use Bun
1.4.4, Vitest 5.1.0, and actual Bun or Node 24.22.1 native workers. The Vitest
provider remains Bun throughout. Node workers are not a separate Node-hosted
Vitest qualification; hosted Node uses a different version.

Each bounded workload runs with one Vitest worker inside a systemd scope capped
at two CPUs and 8 GiB. These diagnostic scopes cap resources; they are not
scheduler-admission receipts. Canonical quality commands retain normal internal
admission. Samples are collected on a shared workstation with changing load.
No sample is discarded. Outer real monotonic clocks are captured before fixture
controlled clocks can replace them.

An initial full-span diagnostic recorded approximately 306,000 versus 207,000
spans per source-document sample. Its timings are diagnostic only: custom tracing
can distort the comparison. The subsequent source-document run uses phase clocks
without a custom tracer. Actual corpus diagnostics filter a small named span set
at collection, retaining nested span boundaries rather than summing overlapping
parents and children. Clock-only corpus corroboration uses no custom tracer.

Private local receipts retain the exact executed probes, source hashes, warmups,
all samples, logs, variant identities and restoration copies under
`.beep/integration-fixture-perf/`. These paths are not public performance artifacts.

## Source-document phase observation

One warmup per variant precedes three alternating pairs for each native worker.
The fixed workload extracts `Foo v. Bar, 1 U.S. 1 (2000). Id. at 2.` through the
real source-document path. Every sample retains two verified mentions, one
authority and 32 spawned/32 independently confirmed retired children.

| Native worker | Phase | Complete replay fixture median, ms | Smaller fixture median, ms |
| --- | --- | ---: | ---: |
| Bun | Fresh fixture installation | 3,616.830 | 1,427.458 |
| Bun | Extraction-stage construction | 460.143 | 447.097 |
| Bun | Extraction and retirement assertions | 6,435.123 | 6,328.675 |
| Bun | Scoped finalization | 2.604 | 1.641 |
| Bun | Complete fixed workload | 10,530.561 | 8,065.822 |
| Node | Fresh fixture installation | 4,426.344 | 1,833.456 |
| Node | Extraction-stage construction | 518.153 | 568.734 |
| Node | Extraction and retirement assertions | 6,364.266 | 7,764.898 |
| Node | Scoped finalization | 0.884 | 1.453 |
| Node | Complete fixed workload | 11,719.008 | 9,818.677 |

All six paired smaller-fixture installation samples are lower. The installation
medians are 60.53% lower for Bun workers and 58.58% lower for Node workers.
Node replay time varies substantially and its smaller-fixture median is higher;
these observations establish no faster production replay claim. Phase medians
need not sum to the median total.

## Actual integration first-row diagnostics

The probe invokes existing exported replay functions with `(kind, 0, 1)`:
`replayCitationCanonicalExtraction` and
`replayCitationCanonicalParserOperations`. Each reads its complete authenticated
capture and selects its original first row. Original model, attribute, source
range, diagnostic and child-retirement assertions remain enabled.

| Native worker / actual corpus | Complete fixture, ms | Smaller fixture, ms | Bundles before / after | Starts / retirements in each |
| --- | ---: | ---: | ---: | ---: |
| Bun canonical extraction | 10,661.715 | 7,920.588 | 4 / 4 | 13 / 13 |
| Bun parser operations | 16,257.733 | 10,449.709 | 4 / 4 | 30 / 30 |
| Node canonical extraction | 12,500.288 | 7,744.632 | 6 / 5 | 13 / 13 |
| Node parser operations | 14,118.605 | 10,666.684 | 6 / 5 | 30 / 30 |

These are one diagnostic observation per cell, collected in separate baseline
and candidate runs. They demonstrate preserved selected-row behavior and expose
cost centers; they are not stable percentage estimates. Baseline fixture setup
took 3.51–4.54 seconds, production layer assembly 2.12–2.97 seconds. Each workload
still performs two production default configuration installations. Native process
start calls themselves total only tens of milliseconds; their child execution
and protocol work remain within replay time.

## Clock-only canonical corroboration

Three alternating pairs replay the same first original case input on actual Bun
workers in separate Bun-hosted Vitest processes, with the original assertions.
Only the two fixture-owner installer selections change between variants; each
process exits before source selection changes. Candidate copies are restored
byte-for-byte and verified afterward. There is no custom tracer or Turbo result
reuse. Process-local bundler/module caches therefore start afresh; filesystem and
operating-system caches remain shared. There is no separate discarded warmup.

| Pair | Order | Complete fixture, ms | Smaller fixture, ms |
| --- | --- | ---: | ---: |
| 1 | Complete, smaller | 14,632.291 | 9,088.562 |
| 2 | Smaller, complete | 11,308.283 | 8,575.339 |
| 3 | Complete, smaller | 13,949.375 | 9,765.875 |
| Median | | 13,949.375 | 9,088.562 |

Every paired smaller-fixture workload is lower. The local median is
34.85% lower for this one original canonical case. This is a bounded
case observation from three pairs under changing shared-host load, without a
statistical-confidence claim. It does not estimate the full canonical corpus,
parser operations, Node workers or hosted CI percentage improvement.

The clock begins immediately before the existing canonical replay effect and
ends after scope finalization. It includes authenticated capture reading, fixture
installation, fresh production layer assembly, extraction, original assertions and
cleanup. It excludes Vitest/import/transform and outer test-layer setup plus
receipt writing. Per-run Vitest totals and import/transform proportions are kept
separately; their difference from the inside clock is runner overhead, not a
precisely isolated pure process-startup measurement.


## Functional verification and limits

Focused source-document, document-extraction and default-configuration proof
passes three files and eleven tests, including two temporary old-versus-smaller
fixture parity checks, one per native worker. Parity checks compare exact assets,
artifact identity, descriptor, effective limits and configuration (normalizing
only the scoped runtime descriptor path). They verify fresh service/runtime
owners, foreign-owner rejection and zero preparation children.

The parity checks remain validation-only probes. Adding an extra complete and
smaller installation to every normal test run could cancel the saved preparation
cost. The existing end-to-end tests retain their assertions and use the smaller
fixture; no permanent benchmark or extra replay-rich installation is added.

Final package-scoped quick verification passes lint (8.0s) and check (7.0s),
including the package test TypeScript check and upstream build closure. A first
post-adaptation check caught an accidentally narrowed unrelated engine helper
contract; restoring that helper's original contract corrected the introduced
failure. The intended default-engine and attribute contracts remain narrow.
`bun run docgen:local` exits successfully with no selected package inputs because
the changes are test fixtures and authored documentation, rather than package
source exports. This is not full docgen proof. Full package audit, complete
integration, coverage and hosted proof are not established by these local probes.
Hosted checks remain required before merge. No CI-job, full-suite, RSS improvement,
statistical-confidence or cross-runtime-version claim follows from these samples.
