# @beep/shared-use-cases — P1 four-lens digest

All rows are open judgments reviewed by Root; P2 remains gated.

## Counts

| Lens | Rows | Review/constraint | Coverage only |
|---|---:|---:|---:|
| resource | 1 | 0 | 1 |
| flake | 1 | 0 | 1 |
| property | 1 | 0 | 1 |
| observability | 1 | 0 | 1 |

Severity: {"info": 4}. Detector candidates remain separate: 0.

## Top ten files by human row count

- `packages/shared/use-cases/test/PromotionGate.test.ts` — 4 rows, 0 review items.

## Source judgments, topology and limits

PromotionGate is a dependency-free Context service port whose evaluate returns an infallible clear/blocked value. The test supplies a local always-clear stub through provideService; it acquires nothing and is valid D14 pure-stub usage. No production vertical adapter or promotion policy is executed. The test should not be represented as proof of real policy acceptance.

The three schema helper calls derive Arbitrary, decode, validate and compare schema equivalence. They are decode-to-self laws, not encoded serialization round-trips despite the test title. This is an explicit proof limit, not a requirement to replace the approved helper. The helper applies fcRuns(options.runs) and therefore preserves the configured floor and seed. All refusal-code negatives remain intact. No file, HTTP client, database, worker, shared clock or background process exists here.

There is no current detector JSONL file for this package and no baseline finding for it. File absence was retained as a preparation observation, not silently discarded input. Current four-lens coverage is still mandatory and has four explicit NONE rows. No independently actionable resource, flake, property or observability residue was established. No hosted observation is mapped; that is not evidence of flake freedom.

## Detailed rows

No additional actionable residue was established in this bounded full-source review. See four file-specific coverage rows; this is not all-behavior proof.

## Retained runtime/history evidence

The accepted first Node command records 3 tests across 1 files, exit 0, whole command 4.574453439s; reporter span 4064.688721ms. Every assigned test file is represented. No new run occurred. Slowest files:

- `packages/shared/use-cases/test/PromotionGate.test.ts`: 12.688721ms, 3 tests.

Full raw hashes, original timing context, top test names and worker settings are retained in the public timing context and bound inputs. Pool forks, fileParallelism=true, isolation=true, maxConcurrency=5, sequenceConcurrentDefault=true and capacity63 are settings, not proof of overlapping execution or guaranteed available resources. Node22.22.3/Bun1.4.2/Vitest4.1.11 was the retained cohort. rc113 declares a Vitest5 peer range; existing runtime qualification is not permission to change dependencies. Reporter/file spans overlap and are not additive setup cost.

Hosted history maps 0 observations / 0 jobs: {}. No unique-flake count is inferred. Globally 527 failed runs retain 21 unavailable logs and one unresolved cause. The 139 timings remain 132 accepted full-file baselines, four configured subsets and three failures; graph-3d's configured-out browser and effect-drizzle's failed Node Bun.sqlite collection remain untouched.

## Proposed P2 ordering

Scope and fixture ownership first, preserving real native/source boundaries; then assertion-family repairs with exact operands and errors; then the identified property/witness gaps with all floors retained; then investigate demonstrated flake causes; finally adopt public instrumentation only where concrete diagnostic needs apply. Coordinate resource/flake rows for the same issue. No tests, assertions or semantics may be weakened, no retry/timeout/global changes are authorized, and Benjamin acknowledgement remains the P2 gate.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
