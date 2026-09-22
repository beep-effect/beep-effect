# @beep/uspto — P1 four-lens digest

All rows are open judgments reviewed by Root; P2 remains gated.

## Counts

| Lens | Rows | Review/constraint | Coverage only |
|---|---:|---:|---:|
| resource | 2 | 1 | 1 |
| flake | 2 | 0 | 2 |
| property | 2 | 1 | 1 |
| observability | 2 | 0 | 2 |

Severity: {"info": 6, "minor": 2}. Detector candidates remain separate: 21.

## Top ten files by human row count

- `packages/drivers/uspto/test/Uspto.equivalence.test.ts` — 4 rows, 0 review items.
- `packages/drivers/uspto/test/Uspto.service.test.ts` — 4 rows, 2 review items.

## Source judgments, topology and limits

The service cases replace HttpClient with a local Layer.succeed stub returning Response values. Actual Uspto.makeLayer is Layer.effect and constructs a service using the supplied client; it does not acquire a socket. The seven EV002 candidates therefore have resolved effectful provenance despite the cheap pure HTTP double. P2 layer ownership must preserve distinct body/status closures and seenUrls arrays. Do not turn those independent cases into a shared mutable responder to reduce nominal builds. No measured setup savings is claimed.

In the first metadata case, seenUrls is a newly allocated local array never supplied to respondWith. Its zero-length assertion cannot witness that request. Preserve every existing assertion, including metadata payloads, and add a connected request witness or explicitly label the local-array invariant; the next test's connected URL capture exercises another invocation. This is the L-PROP-04 proof gap, not a claim that the production request did not execute.

The generated property covers eight schema values with fcRuns(50), using encoded round-trip and declared equivalence. Keep fixed normalization separators, reissue prefix, invalid values, optional metadata omission, error shapes and all predicates. Metadata, continuity and document selection are local envelope tests. The production downloadDocument origin/credential boundary was read to establish that a returned download URL is not downloaded by these tests. No claim of download/SSRF coverage, network delivery or native HTTP conformance is made. Such provider operations are outside this audit.

No independent flake is established: each response closure is isolated and there are no sleeps/retries. The existing scoped providers release per invocation, and their replacement must retain that isolation. No MemoryFileSystem demand exists. No hosted observation is mapped, which cannot establish absence of failures.

## Detailed rows

- **minor L-RES-01** `packages/drivers/uspto/test/Uspto.service.test.ts`:81–82: The seven unresolved EV002 sites resolve to Uspto.makeLayer: Layer.effect reads HttpClient and constructs the service, while respondWith is a pure stub. Move effectful driver ownership to explicit layer blocks in P2, preserving each response/array identity and inner test scope; never share a mutable responder merely to reduce builds. These are cheap local constructions, not measured network setup costs.
- **minor L-PROP-04** `packages/drivers/uspto/test/Uspto.service.test.ts`:112–122: seenUrls is created inside the metadata case but never passed to respondWith, so its zero-length assertion cannot observe the request. Preserve the existing assertion and all metadata operands; add a separately connected capture witness for this response path (or explain/rename the local-array invariant). The next URL test proves a separate call only, not this disconnected observer.

## Retained runtime/history evidence

The accepted first Node command records 13 tests across 2 files, exit 0, whole command 4.822524111s; reporter span 4463.368164ms. Every assigned test file is represented. No new run occurred. Slowest files:

- `packages/drivers/uspto/test/Uspto.service.test.ts`: 44.368164ms, 12 tests.
- `packages/drivers/uspto/test/Uspto.equivalence.test.ts`: 1.114258ms, 1 tests.

Full raw hashes, original timing context, top test names and worker settings are retained in the public timing context and bound inputs. Pool forks, fileParallelism=true, isolation=true, maxConcurrency=5, sequenceConcurrentDefault=true and capacity63 are settings, not proof of overlapping execution or guaranteed available resources. Node22.22.3/Bun1.4.2/Vitest4.1.11 was the retained cohort. rc113 declares a Vitest5 peer range; existing runtime qualification is not permission to change dependencies. Reporter/file spans overlap and are not additive setup cost.

Hosted history maps 0 observations / 0 jobs: {}. No unique-flake count is inferred. Globally 527 failed runs retain 21 unavailable logs and one unresolved cause. The 139 timings remain 132 accepted full-file baselines, four configured subsets and three failures; graph-3d's configured-out browser and effect-drizzle's failed Node Bun.sqlite collection remain untouched.

## Proposed P2 ordering

Scope and fixture ownership first, preserving real native/source boundaries; then assertion-family repairs with exact operands and errors; then the identified property/witness gaps with all floors retained; then investigate demonstrated flake causes; finally adopt public instrumentation only where concrete diagnostic needs apply. Coordinate resource/flake rows for the same issue. No tests, assertions or semantics may be weakened, no retry/timeout/global changes are authorized, and Benjamin acknowledgement remains the P2 gate.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
