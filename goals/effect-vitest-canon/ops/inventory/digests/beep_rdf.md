# @beep/rdf — four-lens P1 source digest

| Lens | Rows |
|---|---:|
| resource | 9 |
| flake | 9 |
| property | 10 |
| observability | 9 |

9 files; 3 review items and 34 coverage rows. Severity counts: info 34, major 2, minor 1.


## Highest-count files and full-read coverage

- `packages/foundation/modeling/rdf/test/ProvRdf.test.ts`: 5 rows; test; fully read 1–519; 21906 bytes; SHA256 `07f82b0281dcc27d34b2143cef454d4ba34f56010a17e597d3afbe9d3b35440a`. All four lenses covered.
- `packages/foundation/modeling/rdf/test/IRI.test.ts`: 4 rows; test; fully read 1–82; 4409 bytes; SHA256 `5479fd3a9709166ccbb4fe381e6c129205e3a4e33066216c25ac447bdacfd6da`. All four lenses covered.
- `packages/foundation/modeling/rdf/test/InteropAndMetadata.test.ts`: 4 rows; test; fully read 1–83; 2936 bytes; SHA256 `b8221eb33c3c9e61f9a98b51e4c3d2637f541e0f0410d8a41a1a74e158ee5154`. All four lenses covered.
- `packages/foundation/modeling/rdf/test/ProvO.test.ts`: 4 rows; test; fully read 1–179; 6283 bytes; SHA256 `d73e2258c5627d132d1416a528265dc0ff01fc5f926b13fcb6bf9f2f75fc88d5`. All four lenses covered.
- `packages/foundation/modeling/rdf/test/Rdf.test.ts`: 4 rows; test; fully read 1–878; 35825 bytes; SHA256 `0bd1aeb843a6a9f7588be9e690d8a193977f21dcc6d248ffb895dcefe1023bc7`. All four lenses covered.
- `packages/foundation/modeling/rdf/test/SemanticSchemaConformance.test.ts`: 4 rows; test; fully read 1–288; 10759 bytes; SHA256 `5fdc876c2d3ef8fba8f6ef68bf7a26b09ce8b4ef234c436efa9cdd1651923eef`. All four lenses covered.
- `packages/foundation/modeling/rdf/test/TaggedError.equivalence.test.ts`: 4 rows; test; fully read 1–15; 683 bytes; SHA256 `2e348ca32e8c216613c5c99d690edca58595b161468535c7824b3018f03cdd5e`. All four lenses covered.
- `packages/foundation/modeling/rdf/test/URI.test.ts`: 4 rows; test; fully read 1–71; 2816 bytes; SHA256 `78d9d65ad71c719e353751ae365bc5832a73b6a34fcd2f99bd7e46cfd1bc8e0f`. All four lenses covered.
- `packages/foundation/modeling/rdf/test/VocabDrift.test.ts`: 4 rows; test; fully read 1–67; 2122 bytes; SHA256 `166142cf45034f924924ce5fc8461e18cddd44206f18a8cd995b3a8cac3148c0`. All four lenses covered.

## Layer topology and native boundaries

All nine files operate on local schema values, RDF terms/datasets, metadata or constant vocabularies. No RDF endpoint, SQL service, filesystem or container is acquired. Native URL parsing is deliberately compared with RFC IRI validation; replacing that native parser would erase its subject. Vocabulary difference() filters to new arrays before sorting, so it does not mutate the imported registry arrays. No expensive layer topology or MemoryFileSystem candidate exists here.

IRI.test.ts and URI.test.ts use assertSchemaArbitraryDecodesToSelf; its current Schema.ts:39–60 passes fcRuns(options?.runs ?? 50), retaining the environment floor/seed. Postgres/provenance and Rdf.test.ts metadata laws also use fcRuns. In contrast, Rdf.test.ts:166–212 passes raw run values for eleven aggregate schema checks, and ProvRdf.test.ts:193–213 passes literal runs:100. The two floor/seed findings add semantic evidence to EV007 and must be resolved when registering native public properties, retaining each original minimum and all equality/failure branches.

The generated PROV law only constructs one string-valued Entity. Fixed core/scalar/qualified-relation tests remain useful and must stay. A bounded constructive relation generator is a P2 opportunity, not evidence that the current codec is defective. Rejection of unsupported extensions, malformed literals, contradictory shortcuts and duplicate subjects must remain independent. No generator explosion, race or current runtime failure was demonstrated. Grouped property evaluation durations are not isolated codec performance measurements.

## Detailed judgment findings

- **L-PROP-03 / major / literal-property-options**, `packages/foundation/modeling/rdf/test/ProvRdf.test.ts:193–213`: The native round-trip check passes { runs: 100 }, omitting fcRuns environment floor and BEEP_FC_SEED. When migrating the existing property to real public registration, pass arbitrary: fcRuns(100). Preserve all nested failure-as-false branches, dataset equivalence, generator and shrink/replay visibility. Native rc113 CheckOptions has no global floor. Do not lower the existing 100-run minimum. This is additional semantic floor/seed residue beyond EV007 registration syntax.
- **L-PROP-03 / major / helper-property-floor-loss**, `packages/foundation/modeling/rdf/test/Rdf.test.ts:166–212`: Both local round-trip helpers pass { runs: runs } with default 25; the metadata property separately uses fcRuns(50). Preserve both distinct equality/stability laws and all eleven schema invocations. Feed each original inline run value through fcRuns when adopting public properties; retain the separate fcRuns(50) law and fixed seed 0x5eed smoke example. CI floor and seed must reach generation, not merely an outer parent.
- **L-PROP-02 / minor / supported-core-generator-subset**, `packages/foundation/modeling/rdf/test/ProvRdf.test.ts:180–192`: The generated supported-PROV law always creates one Entity with string value; qualified relations appear only in fixed examples. Retain the existing Entity law and nine-record core fixture. Add bounded constructive generators for already-supported relation/record variants, unique subjects and coherent parent/target links, then apply the same encode/decode/reencode dataset equivalence. Do not generate unsupported extension records or weaken their rejection. This is an additional coverage opportunity, not proof of a codec defect.

## Retained timing and failure evidence

Node JSON reporter total: 5270.705078125 ms; whole command: 5.6193299780002235 seconds; registrations: 89; reported statuses: {"passed": 89}. All 9 census files are represented. These are frozen first-attempt measurements at main 662823dd960367046ba7d73dd8fd25d15782865a, Node 22.22.3/Bun 1.4.2/Vitest 4.1.11. No tests were rerun. File representation does not establish execution of skipped cases, property floors, coverage or full package acceptance.

Hosted history maps 9 observations across 3 jobs; categories {"coverage-ratchet": 9}. These observations are not unique flakes. Zero mapped observations does not prove no failures.
- https://github.com/beep-effect/beep-effect/actions/runs/32658089966/job/97239925682 — 2026-08-23T18:27:23Z, head `7e34172fb77fb319fab7a36808444755fdb1f034`.
- https://github.com/beep-effect/beep-effect/actions/runs/33353658076/job/99371613322 — 2026-08-31T03:22:44Z, head `7236fb68d90d1f71c6d66e21771855b593ff666c`.
- https://github.com/beep-effect/beep-effect/actions/runs/34438997453/job/102749878919 — 2026-09-10T04:54:36Z, head `bb078d815af12a29f48ef76c83837c8719f59c25`.

Every mapped observation here is a coverage-ratchet report about production paths, not a failed test assertion. Exact historical excerpts, source paths and line references are retained in the hosted history summary; no comparison proves those historical sources equal current source.

## P2 ordering and uncertainty

Scope first: preserve the native subjects and resolve provider candidates using constructor evidence. Then migrate assertion families without losing payload, polarity or diagnostics; retain plain-value expectations. Next preserve all property operands, minima and seeds while addressing this digest's property residue. Then address the concrete environment assumptions without retries or timeout changes. Last adopt the accepted instrumented public runner while retaining names, modes, TestEnv and sanitized error policy. Foundation/modeling work ships separately under D13. No P2 execution is authorized here.

The frozen corpus has 139 terminal attempts: 132 full-file-representation baselines, four configured subsets and three failures. Graph-3d's excluded browser file was neither executed nor reported skipped. The effect-drizzle Bun.sqlite Node collection boundary is unchanged and not repaired by a different driver here. Hosted scope covers 527 failed runs, with 21 unavailable logs and one unresolved downloaded cause; older attempts, deleted and cancelled runs remain outside that scope. No flakyTest proposal is made. Installed rc113 retains the Vitest 5 peer declaration while this evidence uses Vitest 4.1.11; acceptance remains Root's decision.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
