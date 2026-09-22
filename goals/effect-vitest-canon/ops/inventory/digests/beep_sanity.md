# @beep/sanity — P1 four-lens digest

All rows are open judgments reviewed by Root; P2 remains gated.

## Counts

| Lens | Rows | Review/constraint | Coverage only |
|---|---:|---:|---:|
| resource | 2 | 1 | 1 |
| flake | 2 | 1 | 1 |
| property | 2 | 1 | 1 |
| observability | 2 | 0 | 2 |

Severity: {"info": 5, "minor": 2, "major": 1}. Detector candidates remain separate: 6.

## Top ten files by human row count

- `packages/drivers/sanity/test/Sanity.equivalence.test.ts` — 4 rows, 0 review items.
- `packages/drivers/sanity/test/Sanity.service.test.ts` — 4 rows, 3 review items.

## Source judgments, topology and limits

The declared-field equivalence file is entirely pure and intentionally ignores defect-only differences. Service tests use synthetic local Response objects and HttpClient.make, not FetchHttpClient or provider requests. TestLayer combines one Sanity.makeLayer service, one HTTP adapter and one mutable fixture service. The latter allocates capturesRef and respondRef once per anonymous layer context. The pinned rc113 layer runtime caches its build, and anonymous blocks inherit surrounding concurrency; package/root configuration retains sequence.concurrent=true.

The 500-response case mutates the shared responder without restoration. The success case expects the default response and reads captures[0]. Error-first ordering or a compatible overlapping schedule can make those expectations consume the wrong scenario. This is a source-proven ownership hazard, not a reproduced failure: the retained run passed. L-RES-03 describes the fixture boundary; L-FLAKE-05 describes the same issue's ordering trigger, not a second independently observed failure. Prefer distinct scenario fixture ownership; a beforeEach reset alone is insufficient while concurrent cases share state. No global serialization, retry or timeout increase is authorized.

SanityConfigInput accepts an optional RedactedFromValue token, but ConfigInputArbitrary filters all present tokens away. The fixed request fixture proves one synthetic auth header, not generated token-bearing encode/decode. Retain host normalization, seven round-trip laws, invalid ms/status checks and fcRuns(50); add valid synthetic token-present coverage through the actual encoded contract, never real credentials or token logs. Property findings do not authorize schema weakening. All existing Option/Exit/Result assertion candidates retain exact operands and typed error fields; no expected Cause is invented.

Setup costs are only source sites: two Ref allocations and local client/service composition, with no server/container/database acquisition. No MemoryFileSystem demand exists. No hosted observation is mapped to Sanity, which does not prove absence of failures.

## Detailed rows

- **minor L-RES-03** `packages/drivers/sanity/test/Sanity.service.test.ts`:101–133: The anonymous TestLayer caches capturesRef and respondRef across both service cases. The error case changes respondRef without restoring it. Resolve L-FLAKE-05 by giving scenarios independently owned responder/capture state while retaining explicit layer ownership, or prove serial ownership plus reset; a shared reset alone is unsafe under concurrency. No real socket is acquired.
- **major L-FLAKE-05** `packages/drivers/sanity/test/Sanity.service.test.ts`:261–279: The error test installs a 500 responder permanently; the success test expects the default 200 and captures[0]. Anonymous layer inherits sequence.concurrent=true. Error-first ordering or overlapping request handling can contaminate success. Give cases independent fixture state (coordinate L-RES-03), and prove both outcomes without retries, timeout changes or global serialization. Static interleaving risk; no failing execution reproduced.
- **minor L-PROP-02** `packages/drivers/sanity/test/Sanity.service.test.ts`:53–55: The ConfigInput arbitrary discards every present apiToken although SanityConfigInput accepts optional RedactedFromValue strings. The fixed test-token request does not cover generated encode/decode of that branch. Preserve normalization and all seven schema laws with fcRuns(50), adding rich synthetic token-present round-trip cases using the legitimate encoded/equivalence contract without logging token values or weakening schemas.

## Retained runtime/history evidence

The accepted first Node command records 6 tests across 2 files, exit 0, whole command 5.265275532s; reporter span 4940.884766ms. Every assigned test file is represented. No new run occurred. Slowest files:

- `packages/drivers/sanity/test/Sanity.service.test.ts`: 44.884766ms, 4 tests.
- `packages/drivers/sanity/test/Sanity.equivalence.test.ts`: 1.625244ms, 2 tests.

Full raw hashes, original timing context, top test names and worker settings are retained in the public timing context and bound inputs. Pool forks, fileParallelism=true, isolation=true, maxConcurrency=5, sequenceConcurrentDefault=true and capacity63 are settings, not proof of overlapping execution or guaranteed available resources. Node22.22.3/Bun1.4.2/Vitest4.1.11 was the retained cohort. rc113 declares a Vitest5 peer range; existing runtime qualification is not permission to change dependencies. Reporter/file spans overlap and are not additive setup cost.

Hosted history maps 0 observations / 0 jobs: {}. No unique-flake count is inferred. Globally 527 failed runs retain 21 unavailable logs and one unresolved cause. The 139 timings remain 132 accepted full-file baselines, four configured subsets and three failures; graph-3d's configured-out browser and effect-drizzle's failed Node Bun.sqlite collection remain untouched.

## Proposed P2 ordering

Scope and fixture ownership first, preserving real native/source boundaries; then assertion-family repairs with exact operands and errors; then the identified property/witness gaps with all floors retained; then investigate demonstrated flake causes; finally adopt public instrumentation only where concrete diagnostic needs apply. Coordinate resource/flake rows for the same issue. No tests, assertions or semantics may be weakened, no retry/timeout/global changes are authorized, and Benjamin acknowledgement remains the P2 gate.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
