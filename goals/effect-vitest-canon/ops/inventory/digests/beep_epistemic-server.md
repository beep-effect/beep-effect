# @beep/epistemic-server four-lens digest

14 files, 56 rows: 7 review and 49 coverage-only.

Bounded SHACL is pure Layer.succeed; EpistemicServerLive composes in-memory services. Observability service uses actual Layer.effect plus scripted ports and per-case tracer. Governed egress/tier tests have local Ref/Deferred state and recording HTTP/ledger stubs. Four ordinary PGlite repository/gate files use public serial layers; GovernedTierGate has two independent blocks so destructive DDL cannot poison ordinary cases. Each in-process driver owns native temp-directory storage and btree_gist; repeated migrate calls are idempotent setup requests, not a measured full database rebuild per case. Two persistent restart fixtures intentionally build twice on one path, close before reopen and retain outer temp scope. External PG races require actual pools and separate instances; no MemoryFS substitute. Retained slow first cases include migrations/acquisition, but reporter timing does not isolate those costs.

Retained command: 7.869872934999876s whole command; 7508.726806640625ms reporter span; 83 registered tests. 83 passed across12 files with cases; both external PG files have0 registered cases and0ms. This is full file representation, not execution of those opt-in races.

Hosted attribution: three coverage-ratchet observations; these are not named test failures or demonstrated flakes.

## Review items

- `packages/epistemic/server/test/ContradictionTriage.observability.test.ts:102–134` — minor, L-RES-05: runList uses provideScopedLayer around actual ContradictionTriageServiceLive Layer.effect (production layer.ts408-411), with pure repository/config/crypto ports. In P2 make effectful outer ownership public while retaining the per-case recording tracer and failure-specific repository. Preserve action-port-adapter hierarchy and safe attributes; never infer native DB allocation from db.query span name or hoist one recording array across tests. Helper Layer.ts46-49 currently owns build and scope.

- `packages/epistemic/server/test/GovernedTierGate.test.ts:275–306` — minor, L-FLAKE-02: The reversed-settlement race uses yieldNow after each fork before reading decisions. A scheduler yield does not establish that each authorization reached its blocked approved body or that decision order matches fork order. Add explicit started/decision acknowledgements before launching the next actor and inspecting the ledger, retaining fast/slow release Deferreds, joined fibers, second failure and exact hash binding. No arbitrary delay or retry.

- `packages/epistemic/server/test/integration/ContradictionTriage.p0.pglite.test.ts:504–515` — info, L-RES-05: Two private provideScopedLayer calls deliberately close and reopen one on-disk dataDir; TempDirServices is outer ownership. In P2 expose outer native services through public layer registration while retaining shorter database build/close lifetimes and outer directory cleanup. Preserve local P0 tables and actual edge transaction/reopen assertions. MemoryFS cannot replace PGlite native storage. This resolves EV002/EV010 with concrete topology, not blanket scope deletion or a crash/fsync claim.

- `packages/epistemic/server/test/integration/ContradictionTriage.pg.test.ts:280–293` — major, L-FLAKE-02: expectBothWritersWaiting sleeps in PostgreSQL for0.25s then requires two Lock waiters. Slow dispatch/connection startup can miss that deadline while semantics are correct. Await a bounded observable both-writers-blocked condition while retaining distinct PIDs and the blocker transaction, then release and assert exact outcomes. Any real-clock polling must be narrow, bounded and reported; never advance TestClock for pg_sleep, extend global timeouts or retry the race assertion.

- `packages/epistemic/server/test/integration/EdgeAuthority.pg.test.ts:258–284` — major, L-FLAKE-02: The blocker holds a row lock for pg_sleep(0.25) but never observes that both writers reached it. Sequential writers can still yield one success/one stale conflict, so passing counts do not establish the claimed overlap. Add actual connection/lock-state acknowledgements before release, preserving two repository instances, four connections, typed outcomes and lineage checks. Keep native PG; neither arbitrary longer sleep nor TestClock is a substitute. Separately move the reset/migrate prerequisite from the first test into shared setup so filtered race execution has its required schema.

- `packages/epistemic/server/test/integration/EdgeAuthority.restart.pglite.test.ts:203–263` — info, L-RES-05: Private provider builds persistent PGlite twice on one native temp path, with first close before second read. Expose public outer service lifetime in P2 but preserve explicit shorter database scopes, cleanup failures, no migration in reopen and final constraint probe. Do not share one database instance or substitute MemoryFS. Keep relaxedDurability qualification and precise TestClock resolver timestamp. EV002/EV010 remain coordinated candidates, not automatic removal.

- `packages/epistemic/server/test/integration/ExecutionLedger.pglite.test.ts:498–519` — major, L-FLAKE-05: The shared suite drops a decision trigger, asserts tamper evidence, then restores it; the outcome-trigger case repeats this at541-564. Assertion failure or interruption can bypass restoration, leaving altered shared database state. Use guaranteed teardown or an isolated destructive database lifetime, retaining exact forged fields, atIndex1, binding false and visible restoration failures. No swallowing errors or weakening the append-only checks; this is source-proven failure-path contamination, not an observed hosted flake.

## Highest review-count files (at most ten)

- `packages/epistemic/server/test/ContradictionTriage.observability.test.ts`: 1 review / 4 total rows.
- `packages/epistemic/server/test/GovernedTierGate.test.ts`: 1 review / 4 total rows.
- `packages/epistemic/server/test/integration/ContradictionTriage.p0.pglite.test.ts`: 1 review / 4 total rows.
- `packages/epistemic/server/test/integration/ContradictionTriage.pg.test.ts`: 1 review / 4 total rows.
- `packages/epistemic/server/test/integration/EdgeAuthority.pg.test.ts`: 1 review / 4 total rows.
- `packages/epistemic/server/test/integration/EdgeAuthority.restart.pglite.test.ts`: 1 review / 4 total rows.
- `packages/epistemic/server/test/integration/ExecutionLedger.pglite.test.ts`: 1 review / 4 total rows.
- `packages/epistemic/server/test/BoundedShaclValidator.test.ts`: 0 review / 4 total rows.
- `packages/epistemic/server/test/EpistemicServer.test.ts`: 0 review / 4 total rows.
- `packages/epistemic/server/test/GovernedEgress.test.ts`: 0 review / 4 total rows.

## Full file/lens coverage

### packages/epistemic/server/test/BoundedShaclValidator.test.ts

- **resource** (L-RES-NONE): No additional change required by this lens: The actual validator is dependency-free Layer.succeed (BoundedShaclValidator.layer.ts263-275), not the general shacl-engine driver or a container. Public layer owns its lifetime; EV014 is not evidence of native allocation. The temporary constructor spy is restored with ensuring.
- **flake** (L-FLAKE-NONE): No additional change required by this lens: The constructor spy observes shared ShaclValidationViolation.make, but the reviewed validator performs synchronous local traversal and the spy is restored on failure. No observed concurrent contamination is established. Preserve local capture and restoration if this test gains asynchronous validation; do not globally serialize the package from a hypothetical race.
- **property** (L-PROP-NONE): No additional change required by this lens: Positive admission, absent evidence, capped versus uncapped constructor counts, cap zero with both conforming/nonconforming data, target-class exclusion and hasValue mismatch are independent controls. Preserve counts1/3 and zero-cap conformance distinction; no invented arbitrary domain.
- **observability** (L-OBS-NONE): No additional change required by this lens: Exact violation paths/messages and cap count assertions identify the boundary. This is a deliberately bounded SHACL-inspired validator, not full SHACL compliance. No generic log gap found.

### packages/epistemic/server/test/ContradictionTriage.observability.test.ts

- **resource** (L-RES-05): runList uses provideScopedLayer around actual ContradictionTriageServiceLive Layer.effect (production layer.ts408-411), with pure repository/config/crypto ports. In P2 make effectful outer ownership public while retaining the per-case recording tracer and failure-specific repository. Preserve action-port-adapter hierarchy and safe attributes; never infer native DB allocation from db.query span name or hoist one recording array across tests. Helper Layer.ts46-49 currently owns build and scope.
- **flake** (L-FLAKE-NONE): No additional change required by this lens: Per-case recording tracer lists and awaited service calls isolate span capture. Fake repository list operations are local Effects, not PostgreSQL calls; no external wait or demonstrated race.
- **property** (L-PROP-NONE): No additional change required by this lens: Exact action-port-adapter parentage, span counts, sanitized attribute keys, success/failure outcome and unavailable reason provide positive and negative witnesses. TestCrypto identity digest and named db.query are stubs; they prove neither cryptographic integrity nor a production SQL adapter trace.
- **observability** (L-OBS-NONE): No additional change required by this lens: The two tests explicitly witness allowed span keys, hierarchy and bounded failure metadata. Preserve the recording tracer and privacy assertions when adopting instrumentation; no more logging is justified merely by the observability filename.

### packages/epistemic/server/test/EpistemicServer.test.ts

- **resource** (L-RES-NONE): No additional change required by this lens: EpistemicServerLive composes the bounded validator, in-memory repositories and claim services (Layer.ts53-93); it does not start a server. Existing public layer is retained. EV014 may inform a hook option but does not establish container startup.
- **flake** (L-FLAKE-NONE): No additional change required by this lens: One finite admission/transition case has no polling, detached child or shared clock mutation.
- **property** (L-PROP-NONE): No additional change required by this lens: The real claim gate admits the supplied evidence and the real transition reaches shape_valid. This is a composition smoke test; it does not claim all rejection cases, which have separate validator coverage.
- **observability** (L-OBS-NONE): No additional change required by this lens: Named gate/transition case and exact lifecycle expectation localize the failure. Preserve the real bounded validator; no native-server readiness claim.

### packages/epistemic/server/test/GovernedEgress.test.ts

- **resource** (L-RES-NONE): No additional change required by this lens: Each makeHarness creates recording fetch, Ref ledger and Deferred state locally. The fetch returns a constructed Response or scripted rejection/throw; it never sends HTTP. Actual governed wrapper is the subject, while ledger persistence is separate.
- **flake** (L-FLAKE-NONE): No additional change required by this lens: Outcome-stall test explicitly acknowledges outcomeStarted before the second request and advances TestClock before awaiting the first. The20-request case yields within append to widen contention and awaits all requests. Retain these controls and request-local state; no arbitrary wall-time wait identified.
- **property** (L-PROP-NONE): No additional change required by this lens: Allowed delivery is positively witnessed; denied/lookalike/userinfo targets and failed decision writes witness zero fetch attempts. Dense20-decision chain, hash bindings, rejected/synchronous fetch and failed/stalled settlement cases remain. Plain projected arrays and strings are legitimate D5 values.
- **observability** (L-OBS-NONE): No additional change required by this lens: Reason-free refusal shape, exact allowed target, redirect error mode and unsettled records provide useful diagnostics. Preserve bounded denial vocabulary and full-URL digest without logging request content; no real provider execution is claimed.

### packages/epistemic/server/test/GovernedTierGate.test.ts

- **resource** (L-RES-NONE): No additional change required by this lens: Actual gate and dispatcher are used with per-test Ref ledger and static config. Pure provided service values remain legal; no database, transport or external tool is invoked.
- **flake** (L-FLAKE-02): The reversed-settlement race uses yieldNow after each fork before reading decisions. A scheduler yield does not establish that each authorization reached its blocked approved body or that decision order matches fork order. Add explicit started/decision acknowledgements before launching the next actor and inspecting the ledger, retaining fast/slow release Deferreds, joined fibers, second failure and exact hash binding. No arbitrary delay or retry.
- **property** (L-PROP-NONE): No additional change required by this lens: Write-ahead event order, refusal-before-effect, chain/binding, distinct sessions, callerless/write failure, settlement failure and mixed client IDs are explicit controls. Keep exact failure boom and bounded refusal strings; Boolean outcome witnesses do not authorize invented expected Causes.
- **observability** (L-OBS-NONE): No additional change required by this lens: Named ledger/dispatch outcomes and recording event order expose failures. Preserve original dispatcher result tags and request identity; this file is an offline gate test, not an MCP server run.

### packages/epistemic/server/test/IdentityShaclProjection.e2e.test.ts

- **resource** (L-RES-NONE): No additional change required by this lens: Public identity policy projects RDF and uses the dependency-free bounded validator layer; no SQL, HTTP or external SHACL engine is acquired despite e2e name.
- **flake** (L-FLAKE-NONE): No additional change required by this lens: Fixed identity/shape data and synchronous validation avoid external waits. No mutable shared resource beyond immutable service composition.
- **property** (L-PROP-NONE): No additional change required by this lens: Valid projection plus surplus identifier and missing required Fiber cases retain exact path/severity witnesses; Option absence explicitly fails. No vacuous optional assertion or weakened schema found.
- **observability** (L-OBS-NONE): No additional change required by this lens: Projection cases name the identity constraint and fail explicitly when a required violation is absent. Preserve these precise diagnostics and the actual projection service.

### packages/epistemic/server/test/integration/ContradictionTriage.p0.pglite.test.ts

- **resource** (L-RES-05): Two private provideScopedLayer calls deliberately close and reopen one on-disk dataDir; TempDirServices is outer ownership. In P2 expose outer native services through public layer registration while retaining shorter database build/close lifetimes and outer directory cleanup. Preserve local P0 tables and actual edge transaction/reopen assertions. MemoryFS cannot replace PGlite native storage. This resolves EV002/EV010 with concrete topology, not blanket scope deletion or a crash/fsync claim.
- **flake** (L-FLAKE-NONE): No additional change required by this lens: Two persistent scopes are sequential inside one serial test; no timing sleep or parallel database ownership. Temporal values are explicit. Reopening the same path must remain after close, not an ambient clock or fsync timing claim.
- **property** (L-PROP-NONE): No additional change required by this lens: Identity/symmetry/suppression and temporal transitions use a local P0 candidate/receipt/disposition fixture alongside the real edge repository. Both pre/post transaction counts and competing lineage values are checked. This is not proof of the full production contradiction repository, whose cases are separate.
- **observability** (L-OBS-NONE): No additional change required by this lens: One named compound gate retains exact key, receipt, temporal and reopen assertions. P2 instrumentation must retain inner failure/cleanup context. relaxedDurability means no crash/fsync guarantee; reopening is in the same test process.

### packages/epistemic/server/test/integration/ContradictionTriage.pg.test.ts

- **resource** (L-RES-NONE): No additional change required by this lens: Actual external PostgreSQL, distinct backend PIDs and fresh single-connection repository stacks are essential. Public outer two-connection layer and shorter scoped stacks close before rebuilt reads; EV004 is intentional lifetime review, not an instruction to flatten. No MemoryFS/PGlite substitution.
- **flake** (L-FLAKE-02): expectBothWritersWaiting sleeps in PostgreSQL for0.25s then requires two Lock waiters. Slow dispatch/connection startup can miss that deadline while semantics are correct. Await a bounded observable both-writers-blocked condition while retaining distinct PIDs and the blocker transaction, then release and assert exact outcomes. Any real-clock polling must be narrow, bounded and reported; never advance TestClock for pg_sleep, extend global timeouts or retry the race assertion.
- **property** (L-PROP-NONE): No additional change required by this lens: Both races count one winner/one typed loser, inspect persisted disposition/version counts and rebuild repository stacks. Distinct PID and lock-state checks are positive concurrency witnesses. Preserve stale-version/rejection and shared-edge supersession identities; Node baseline registers zero cases here.
- **observability** (L-OBS-NONE): No additional change required by this lens: Race-specific names, actual backend PID/lock state and exact persisted counts are concrete diagnostics. Preserve real DB error payloads and opt-in URL gate without reading credentials. No hosted race execution established.

### packages/epistemic/server/test/integration/ContradictionTriage.pglite.test.ts

- **resource** (L-RES-NONE): No additional change required by this lens: One serial public layer holds real temp-directory PGlite with btree_gist and production Drizzle repositories; Layer.fresh isolates it from other blocks. Scenario seeds use distinct identities. Preserve migration/transaction ownership and native SQL constraints rather than substituting MemoryFS.
- **flake** (L-FLAKE-NONE): No additional change required by this lens: Explicit knownAt/validAt queries and TestClock.setTime govern domain time; serial registration owns the shared clock/database. No fixed delay or retry. Keep distinct scenario keys and serial ownership on any future layer change.
- **property** (L-PROP-NONE): No additional change required by this lens: Sixteen production-repository cases cover reversed/reordered evidence idempotency, organization isolation, receipt changes, invalid temporal/evidence inputs before persistence, corrupt legacy verification, rejection and supersession. Retain positive rows alongside negative count witnesses and all tagged operands; avoid duplicating EV006.
- **observability** (L-OBS-NONE): No additional change required by this lens: Named conflict reasons, expected row counts, exact normalized verification keys and temporal facts make failures specific. Corrupt row insertion is deliberate guarded-converter bypass, not a production fixture weakness. No generic missing-log finding.

### packages/epistemic/server/test/integration/EdgeAuthority.pg.test.ts

- **resource** (L-RES-NONE): No additional change required by this lens: Four-connection actual PostgreSQL pool and two repository instances avoid pool/local-semaphore serialization. Public layer holds the external resource; raw lock-skipping SQL is the database-backstop subject. Preserve both connection and instance multiplicity; no memory replacement.
- **flake** (L-FLAKE-02): The blocker holds a row lock for pg_sleep(0.25) but never observes that both writers reached it. Sequential writers can still yield one success/one stale conflict, so passing counts do not establish the claimed overlap. Add actual connection/lock-state acknowledgements before release, preserving two repository instances, four connections, typed outcomes and lineage checks. Keep native PG; neither arbitrary longer sleep nor TestClock is a substitute. Separately move the reset/migrate prerequisite from the first test into shared setup so filtered race execution has its required schema.
- **property** (L-PROP-NONE): No additional change required by this lens: One winner/loser, version/count/open-head identity and named actual constraints are real backstop controls. Race A currently lacks a positive both-writers-blocked observation; the flake row records that gap. Keep raw constraint-bypass probe and all existing assertions.
- **observability** (L-OBS-NONE): No additional change required by this lens: Explicit race A/B/C labels and constraint names preserve failure context. Source comments claiming guaranteed overlap are stronger than the fixed delay proves. No external PG cases registered in retained Node baseline; no current race execution claimed.

### packages/epistemic/server/test/integration/EdgeAuthority.pglite.test.ts

- **resource** (L-RES-NONE): No additional change required by this lens: One public serial layer owns the actual btree_gist-capable PGlite/Drizzle stack. Scenario-local endpoints give distinct logical keys; malformed writes intentionally remain last. Do not conflate single-connection constraint tests with real multi-connection races.
- **flake** (L-FLAKE-NONE): No additional change required by this lens: Explicit temporal instants and TestClock for readLatest avoid wall-time ambiguity. Shared database is serial and scenario keys differ; no fixed wait. Keep this ownership when public runner instrumentation is adopted.
- **property** (L-PROP-NONE): No additional change required by this lens: Half-open valid-time boundaries, retroactive correction, late/disjoint insert, stale/no-head versions, named constraint and durable gate dispositions have positive/negative witnesses. Preserve exact version/fact/constraint fields, not just generic failure.
- **observability** (L-OBS-NONE): No additional change required by this lens: Case names and exact constraint messages distinguish malformed writes from supersession conflicts. Inspect-based database cause checks are intentionally native diagnostics; retain them rather than inventing a full expected Cause.

### packages/epistemic/server/test/integration/EdgeAuthority.restart.pglite.test.ts

- **resource** (L-RES-05): Private provider builds persistent PGlite twice on one native temp path, with first close before second read. Expose public outer service lifetime in P2 but preserve explicit shorter database scopes, cleanup failures, no migration in reopen and final constraint probe. Do not share one database instance or substitute MemoryFS. Keep relaxedDurability qualification and precise TestClock resolver timestamp. EV002/EV010 remain coordinated candidates, not automatic removal.
- **flake** (L-FLAKE-NONE): No additional change required by this lens: Write and reopen scopes run sequentially within one test, with explicit resolver time and unchanged dataDir. No fresh-db substitution, elapsed-time timing assumption or retry; relaxed durability is explicitly not an fsync proof.
- **property** (L-PROP-NONE): No additional change required by this lens: Reopened facts100/150, lineage, recorded/resolved instants, disposition messages and re-provoked exclusion constraint are independent persistence witnesses. Second scope does not migrate. This is same-process reopen evidence, not an actual process crash test.
- **observability** (L-OBS-NONE): No additional change required by this lens: Named reopen case retains both temporal answers and constraint name. Instrumentation must not obscure failure during first close or second acquisition, and must not reclassify the final expected typed conflict as teardown success.

### packages/epistemic/server/test/integration/ExecutionLedger.pglite.test.ts

- **resource** (L-RES-NONE): No additional change required by this lens: Serial public layer owns one actual migrated PGlite ledger. Fixed per-case run keys isolate rows; raw SQL intentionally bypasses codecs for database constraints. Trigger mutation cleanup is separately flagged by the flake lens.
- **flake** (L-FLAKE-05): The shared suite drops a decision trigger, asserts tamper evidence, then restores it; the outcome-trigger case repeats this at541-564. Assertion failure or interruption can bypass restoration, leaving altered shared database state. Use guaranteed teardown or an isolated destructive database lifetime, retaining exact forged fields, atIndex1, binding false and visible restoration failures. No swallowing errors or weakening the append-only checks; this is source-proven failure-path contamination, not an observed hosted flake.
- **property** (L-PROP-NONE): No additional change required by this lens: Intact and tampered chains, exact broken index, orphan/duplicate/denied outcomes, bounded reason/settlement, genesis and append-only UPDATE/DELETE/TRUNCATE are deliberate positive/negative controls. Keep all raw SQL and constraint assertions; owner-trigger bypass proves tamper evidence, not tamper proof.
- **observability** (L-OBS-NONE): No additional change required by this lens: Named constraint and tampering cases retain exact atIndex1 and binding false witnesses. The synthetic exfiltration string is fixture data. No production secret is read and no generic logger leak is alleged.

### packages/epistemic/server/test/integration/GovernedTierGate.pglite.test.ts

- **resource** (L-RES-NONE): No additional change required by this lens: Two public layer blocks intentionally create separate PGlite databases: ordinary write-ahead cases and destructive table-drop failure case. Keep fresh memo-map isolation, btree_gist and actual SQL failure. Native DB behavior cannot be replaced with a stub or MemoryFS.
- **flake** (L-FLAKE-NONE): No additional change required by this lens: Serial block ownership makes before/after global run-key and row-count comparisons meaningful. Dispatches are awaited, no sleeps. Preserve separate destructive block and ordering if expanding concurrency.
- **property** (L-PROP-NONE): No additional change required by this lens: Allowed decision exists during effect; denied dispatch records one row with no effect/outcome; mixed session chains retain0/1/2 and two bound outcomes. Destructive DB case proves refusal and zero effect, alongside real positive controls. No arbitrary property proposed for external state.
- **observability** (L-OBS-NONE): No additional change required by this lens: Each dispatch mode has a concrete name and exact counts/bindings. Retain actual driver failure rather than scripted replacement; source and timing evidence do not prove an HTTP/MCP transport was exercised.

## P2 order and limits

After separate P2 authorization: Preserve native database close/reopen scopes, per-case tracers and serial ownership. Replace dispatch/PG timing assumptions with actual started and lock-state acknowledgements. Guarantee trigger restoration on failure or isolate destructive tests. Preserve all SQL constraints and the external-PG execution gap. Retain original operands, polarity and diagnostics; do not lower floors or extend timeouts.

Source inventory only. No tests, databases, providers, credentials, benchmarks, Git or canonical writers ran. Passing retained timing is not coverage, compiler, package or race proof. Node22.22.3/Bun1.4.2/Vitest4.1.11 retained; rc113 declares Vitest5 peer range, with prior compatibility proof separate. Global139 attempts:132 full-file baselines,4 configured subsets,3 failures (CIops, Effect Drizzle, QA Capture). Hosted527 failed observations include21 unavailable logs and1 unresolved cause; observations are not unique flakes. All90 inherited-main detector additions untouched. P2 remains gated.

Root-reviewed P1 inventory; all findings remain open judgments.

Root accepted these P1 rows after full report/digest and source/artifact review, actual terminal validation and combined strict validation without input drift. Full P1 completeness, Grok review and Benjamin acknowledgement remain required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
