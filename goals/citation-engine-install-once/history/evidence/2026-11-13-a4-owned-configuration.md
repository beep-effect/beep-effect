# Slice A4: configuration owned once at the engine boundary

Recorded 2026-11-13 on `perf/citation-owned-configuration`, based on
`origin/main` at `2fd1c66ea55` (A3 merged as #3282).

Status: in review after owner round 3. The per-call rows are unchanged and the
construction row moves from 10 configuration detaches to 1, the design's
target. Round 2 added the reference-pattern authentication hoist and the
leaf-helper typing; round 3 derives the default engine's installed
configuration from the owned caller configuration (sections at the end).

## What moved

- **`CitationOwned` brand.** New `C/ConfigurationOwnership.ts`:
  `CitationOwned<A> = A & Brand.Brand<"CitationOwned">` with a module-private
  mint; `ownCitationConfiguration(schema, raw, invalid)` decodes the caller
  value and detaches it once through `S.toCodecJson(schema)` (span
  `Citation.ownConfiguration`); `ownedField` and `ownedItems` project owned
  children; `ownedStruct` assembles an owned value from owned parts only
  (decision "Assemble owned child configuration with ownedStruct").
- **Boundary.** `make` (CitationEngineLive) and `makeDefault`
  (CitationEngineDefaultLive) in `CitationEngine.layer.ts`, and `make` in
  `CitationExtractor.layer.ts`, own their configuration with
  `ownCitationConfiguration` where they used `captureCitationSnapshot`. The
  engine's install body (`install`) takes `CitationOwned<CitationEngineConfiguration>`
  and reads limits and the artifact from it instead of re-snapshotting them.
- **Installers below the boundary.** `makeCitationMetadataStage` no longer has a
  `schema` or `invalid`: it takes typed limits and runtime and
  `CitationOwned<C>`, and decodes nothing. Every stage built on it, the
  publication operation (`makeCitationPublicationMetadataOperation`), the law,
  journal, post-case, pre-case, pin, case-metadata, full-extraction,
  reference-token, extraction-loop and tokenizer installers, and the source
  cleaning, resolution and annotation operations take owned configuration (and
  owned limits where the old install snapshotted them). Parents project child
  configuration with `ownedField`.

### Removed detach, decode and copy sites

| Site | Was | Now |
| --- | --- | --- |
| `detachCitationMetadataConfiguration` (span `Citation.detachMetadataConfiguration`) | encode/decode round trip | deleted |
| `SemanticExtraction.ts` `ownCitationSemanticExtraction` | detach of the semantic subtree | owned input, no detach |
| `DocumentExtraction.ts` `ownCitationDocumentExtraction` | detach | owned input, no detach |
| `TokenizedExtraction.ts` `own` | detach | owned input, no detach |
| `ExtractionLoop.ts` `makeCitationExtractionLoop` | decode plus detach | owned input |
| `decodeCitationMetadataConfiguration`, `decodeCitationMetadataRuntimeConfiguration`, `installCitationMetadataConfigurationStage` | per-stage policy, runtime and configuration decode | deleted; `installCitationOwnedStage` takes owned input |
| `makeCitationMetadataStage` | per-stage decode | none |
| `copyCitationMetadataPatternConfiguration` | prepare plus fingerprint, schema decode, descriptor copy | `prepareCitationMetadataPatternConfiguration`: prepare plus fingerprint only |
| `ownCitationStageCall` `copy` step and every `copyCitation*Configuration` | copy | `verify` step, `verifyCitation*Configuration`: authentication only |
| `prepareCitationPublicationMetadata` | configuration and runtime decode, descriptor copies | prepare plus fingerprint only |
| `makeCitationLawMetadata`, `JournalMetadata`, `PostCaseMetadata`, `CaseMetadata`, `FullExtraction`, `ReferenceTokenExtraction` | policy, runtime and configuration decode | none |
| `Tokenizer.ts` `prepareTokenizerConfiguration` | decode plus field-by-field copy of 6,805 extractors and 2,533 editions | none; the pattern ceiling, duplicate-id and descriptor-consistency guards stay |
| `HtmlGeometryPreparation`, `AnnotationEntry` | runtime copies | none |
| `ReferenceTokenExtraction` | edition row copy | none |
| `CitationEngine.layer.ts` `make` | `captureCitationSnapshot` plus `captureCitationOperationPolicy` | one `ownCitationConfiguration` |
| `AnnotationOperation`, `SourceCleaning`, `SourceResolution` install | `captureCitationOperationPolicy` of the policy at install | owned limits, no install snapshot |

The four per-request report snapshots stay exactly as they were
(`captureCitationOperationPolicy` inside each returned call in
`SourceExtraction.ts`, `SourceCleaning.ts`, `SourceResolution.ts` and
`AnnotationOperation.ts`), and the 2026-11-07 report-mutation tests pass
unchanged (`CitationSourceCleaning.test.ts`, `CitationSourceAnnotation.test.ts`,
`CitationResolverBoundary.test.ts`).

## Counts (the gate)

The full-span probe, `CitationCanonicalFullSpan.test.ts`, Bun cohort. The
probe's `configurationDetaches` column now counts `Citation.ownConfiguration`;
the old span no longer exists, so the boundary own is counted, not hidden.

Per call, before (A3) and after (A4):

| Call | Installs | Detaches | Tokenizer builds | Evaluator installs | Evaluations | Child processes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 to 10, each | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | unchanged | unchanged |
| **Total** | **0 → 0** | **0 → 0** | **0 → 0** | **0 → 0** | **291 → 291** | **291 → 291** |

Construction (one more identical default engine built in the replay's scope):

| Engine construction | Metadata-operation installs | Configuration detaches | Tokenizer builds | Regex evaluator installs | Regex evaluations | Child processes | Process owners | Diff/Xml workers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A3 | 16 | 10 | 1 | 26 | 0 | 0 | 1 | 0 |
| A4 | 16 | **2** | 1 | 26 | 0 | 0 | 1 | 0 |

The A3 10 were all `Citation.detachMetadataConfiguration` spans; the two
boundary snapshots (`Citation.captureSnapshot` in `makeDefault` and `make`)
were not in the probe's span map. The A4 2 are the two boundary owns on the
default path: `makeDefault` owns its caller configuration, then `make` owns the
configuration assembled from it and from the engine-loaded assets (decision
"Stop the default engine at two owns: engine-loaded assets cannot be minted
owned"). An engine built with `CitationEngineLive` owns once.

Snapshots that remain at default-engine construction and that the probe's
detach column does not count, measured by rerunning the construction test with
each span name in place of `Citation.ownConfiguration` (a local, uncommitted
probe edit, A4 code only; A3 was not measured this way):

| Span at construction (A4) | Count | Where |
| --- | --- | --- |
| `Citation.captureSnapshot` | 1 | `makeCitationEngineArtifact`, the artifact descriptor |
| `Citation.snapshotValue` | 8 | the one inside that capture; build identity and limits in `makeCitationDefaultEngineConfiguration` (2); limits inside the `makeCitationSourceEvidence` and `makeCitationSourceRequestAdapter` helper installs (5) |
| `Citation.captureOperationPolicy` | 0 | the install-time policy snapshots in `make`, `AnnotationOperation`, `SourceCleaning` and `SourceResolution` are gone; only the per-request report snapshots remain |

The artifact snapshots are recorded in the default-engine stop decision; the
helper limits snapshots belong with the leaf-helper scope decision.

## Results identical

`CitationCanonicalFullSpan.test.ts` passes 12 of 12 with only the
construction row's `configurationDetaches` changed (10 → 2): the ten Bun calls,
the node parity call and the construction test. All per-call rows and the
thirteen original full-span equalities hold.

## Stops and decisions

- "Own the default engine configuration by derivation from the owned caller
  configuration" (owner ruling, round 3; replaces the default-engine stop).
- "Keep fixed-pattern authentication at the installed call site, once per
  engine" (owner ruling; replaces the round-1 fingerprint stop).
- "Type the leaf helpers and drop their configuration decodes" (owner ruling;
  replaces the round-1 decision to keep them).
- "Assemble owned child configuration with ownedStruct and derive it with
  ownedDerive".
- "Assert configuration refusals at the boundary in direct-stage tests".

## Wall time (reported, not a gate)

Bun, per call in milliseconds, workstation, one run of the whole file
(`bunx --bun vitest run test/CitationCanonicalFullSpan.test.ts --reporter=verbose`).

| Run | Load average (1/5/15 min) | Calls 1 to 10 | Total | Node call 1 | Construction |
| --- | --- | --- | --- | --- | --- |
| A3, final code (from the A3 record) | 59.9 / 44.1 / 41.3 at start | 13913, 2662, 2540, 3836, 3789, 2865, 13330, 10054, 4641, 4413 | 62.0 s | 11932 | 5566 |
| A4 | 19.5 / 39.6 / 51.2 at start, 20.6 / 35.9 / 49.1 at end | 9876, 1878, 2035, 3297, 2625, 2925, 10895, 4358, 1845, 1957 | 41.7 s | 15362 | not printed |

The loads differ, so the comparison is indicative only. No remote-worker run
was taken for this slice.

## Checks

All local, one vitest process per file, `bunx --bun vitest run`.

| Check | Result |
| --- | --- |
| `CitationCanonicalFullSpan.test.ts` | 12/12, twice (gate run and wall-time run) |
| Each affected test file (129: every changed test file, every test importing a changed fixture other than the widely shared regex-worker and probe fixtures, every test using the shared install-controls helper, the engine layer, resolver, cleaning, annotation and extractor tests) | 126 pass first time. `CitationSourceAnnotation.test.ts` failed (2): a direct `makeCitationAnnotationOperation` caller mutated its limits after install, which the removed install-time snapshot used to absorb; the annotation, cleaning and resolution installers now require `CitationOwned` limits and the tests mint them through the boundary; passes 6/6. `CitationTokenizer.test.ts` failed (1): an incoherent extractor is now refused at the boundary, so the tokenizer adapter maps the refusal to the tokenizer's closed failure; passes 10/10. `CitationCaseNameScan.test.ts` failed once on `extractDeadline` at load 44 and passes 4/4 on an unchanged rerun (host load). |
| Reruns after the limits change | `CitationSourceAnnotation`, `CitationSourceAnnotationTiming`, `CitationSourceCleaning`, `CitationResolverBoundary`, `CitationEngineLayer` (15/15): all pass |
| Report-mutation tests (2026-11-07) | `CitationSourceCleaning`, `CitationSourceAnnotation`, `CitationResolverBoundary`: pass. The report assertions are unchanged, but the install-time mutation step (the caller changing its limits after install) now goes through the boundary adapter, which owns the limits first (corrected in round 4) |
| New `CitationConfigurationOwnership.test.ts` | 3/3: caller `Uint8Array` buffers are not shared after `own`; refusal maps to the caller's failure; projections and `ownedStruct` |
| `bun run beep quality package-verify @beep/law-practice-server --quick` | pass (lint, check) |
| `lint:laws` (package) | pass; effect-fn 0 findings (three advisory terse-effect findings in files this slice does not touch) |
| `bun run beep quality fallow audit --check --base origin/main` | pass: 0 introduced, 36 inherited-adjacent |
| `bun run docgen:local` | pass |
| `bun run beep lint effect-vitest` | introduced 0, resolved 0. The writer's positional churn outside the changed Citation test files was restored to main; three reviewed EV003 exception rows whose evidence text changed carry their existing reasons. |
| `bun run beep lint policy-fingerprint --check` | current |
| `bunx biome check` on every changed file | pass |
| Typecheck, source and tests (`tsrs`) | clean |
| `bun run beep models check` | fails on home-directory configuration only (`~/.grok/config.toml`, `~/.claude/settings.json`, `~/.zshrc`); no repository pin is stale. Not touched by this slice. |

Not run locally: the whole law-practice suite, full `package-verify`,
coverage and the integration cohort. Those are left to hosted CI.

## Round 2 (owner rulings)

Commits on top of `9b1a9086679`: `c488a9cefee` (ruling 2 and the re-stated
ruling-1 stop) and `96cc4aad463` (ruling 3).

### Ruling 1: stopped again

`loadCitationJsonAsset` decodes sealed text through each asset's
`S.toCodecJson` + `S.fromJsonString` codec, so a sealed-text route would be
sound for the decoded assets. But the engine configuration is derived from
them: `makeCitationCanonicalTokenizerCatalog` converts 6,805 regex texts to new
native storage, fingerprints them and joins them with metadata, and
`makeCitationHelperConfigurations` splices in a clock-computed year. Nothing
types those fresh values owned without a mint for engine-built values, so the
default engine still owns twice. `makeCitationDefaultEngineConfiguration`,
`makeCitationEngineArtifact` and `makeCitationSixFormArtifact` keep their
snapshots: each is a separately callable entry point with its own raw-input
tests. Proposed reshapes are in the stop decision.

### Ruling 2: reference-pattern authentication hoisted

`installCitationReferencePatterns` authenticates the fixed patterns and
computes the rejection fingerprint once per installed call site (twice per
engine: pincited and markup), captures each with `Effect.exit`, and every
request's `make` replays them where it used to compute them. The builder stays
per request for its budget reservations; the authentication used an
unaccounted pattern input, so `producedTextUtf16` and refusal order are
unchanged. The full-span per-call rows are unchanged (the authentication spans
are not counted columns).

### Ruling 3: leaf helpers typed

32 helper modules take typed limits, plus the evaluator install, the Diff, Xml,
Html and Recognizer worker clients, the process owner, both admissions, the
text budget, cleaners and document services; configuration arguments are typed
too. `prepareCitationNativeRuntime` (a decode plus a limits codec round trip on
every evaluator install and every Diff or Xml worker) is deleted. Guards, worker
frame decodes and the raw entry points' own decodes stay (decision "Type the
leaf helpers and drop their configuration decodes").

One semantic note: the descriptor registry decoded raw bindings with
`onExcessProperty: "error"`, refusing unknown capture-name keys, while the
boundary decode drops them as the old engine snapshot did. In the engine,
descriptors already passed the engine's default decode on main, so engine
behavior is unchanged; the direct registry test keeps the strict decode in its
boundary adapter.

### Measured snapshot spans at construction after round 2

| Span | After round 1 | After round 2 |
| --- | --- | --- |
| `Citation.ownConfiguration` (probe column) | 2 | 2 |
| `Citation.captureSnapshot` | 1 | 1 (artifact descriptor) |
| `Citation.snapshotValue` | 8 | 3 (the one inside that capture; build and limits in `makeCitationDefaultEngineConfiguration`) |
| `Citation.captureOperationPolicy` | 0 | 0 |
| `Citation.prepareNativeRuntime` | not measured | 0 (deleted) |

The sealed-text route was not built, so there are no sealed-text owns to count.

### Ownership check against the reference

`ownCitationConfiguration` decodes with `S.toType(schema)`, encodes with
`S.toCodecJson(schema)` and decodes the JSON value back. The old boundary did
the same plus `S.fromJsonString`, which only adds a `JSON.stringify` and
`JSON.parse` layer on top of the same codec (`Schema.ts` `fromJsonString` is
`JsonString.pipe(decodeTo(schema, fromJsonString))`). `S.Uint8Array`'s JSON
codec goes through a base64 string (`Schema.ts`: `toCodecJson` is
`Base64String` with `uint8ArrayFromBase64String`), so the owned value gets a new
buffer. `CitationConfigurationOwnership.test.ts` proves it: it mutates the
caller's buffer after owning and the owned bytes are unchanged.

### Round-2 wall time

| Run | Load average (1/5/15 min) | Calls 1 to 10 | Total | Node call 1 |
| --- | --- | --- | --- | --- |
| After ruling 3 | 63.9 / 51.9 / 45.0 at start, 49.7 / 49.8 / 44.7 at end | 8697, 1839, 1890, 2869, 2433, 2055, 8442, 4439, 1973, 2246 | 36.9 s | 20692 |

### Round-2 checks

| Check | Result |
| --- | --- |
| Every Citation test file (233), one vitest process each | 224 pass first time; 9 failed and were fixed: seven fed malformed or range-invalid fixtures through the new adapters or mutated caller limits after install (now owned through the boundary first, same assertions), and the descriptor registry's exact-key strictness (kept in its test adapter). All 9 pass on rerun. |
| `CitationCanonicalFullSpan.test.ts` | 12/12, twice (first in the sweep, then the wall-time run) |
| Reference-pattern files | `CitationReferencePatterns`, `CitationReferencePatternsCoverage`, `CitationGeneratedReferences`: pass |
| `package-verify --quick` | pass |
| `lint:laws` | pass; effect-fn 0 |
| fallow audit vs `origin/main` | 0 introduced, 39 inherited-adjacent |
| `docgen:local` | pass |
| effect-vitest | introduced 0, resolved 0; every changed inventory row is in a Citation test file this branch changed, the rest restored to the branch base |
| biome, typecheck (source and tests), policy-fingerprint | pass, clean, current |
| `beep models check` | fails on home-directory configuration only, as before |

## Round 3 (owner ruling: derive, don't re-detach)

Commit on top of `d7659d584cd` (see the report for the SHA). `ConfigurationOwnership.ts`
gains `ownedDerive(owned, derive)`: the result is owned because the engine
computes it from an owned input and from values it creates or reads itself.
`makeDefault` owns the caller's raw default configuration once, derives the
installed `CitationEngineConfiguration` (sealed assets, tokenizer catalog,
helper configurations, limits and runtimes projected from the owned default
configuration, validated by `CitationEngineConfiguration.make`) with
`ownedDerive`, and calls the internal `install` directly. `make` keeps its one
own and calls the same `install`.

Aliasing: `makeDefault` reads `raw` only in its first own; nothing below reads
it again. The default-boundary mutation test already exists:
`CitationEngineLayer.test.ts` › "four-operation engine Layer" › "captures
default owners and executes all four operations on bun" / "… on node" mutates
the caller's `limits.cleanDeadline` and `runtime.workerFile` after the Layer is
built; the reported deadline is unchanged and all four operations still run
(15/15 pass).

| Engine construction | Metadata-operation installs | Configuration detaches | Tokenizer builds | Regex evaluator installs | Regex evaluations | Child processes | Process owners | Diff/Xml workers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A3 | 16 | 10 | 1 | 26 | 0 | 0 | 1 | 0 |
| A4, rounds 1 and 2 | 16 | 2 | 1 | 26 | 0 | 0 | 1 | 0 |
| A4, round 3 | 16 | **1** | 1 | 26 | 0 | 0 | 1 | 0 |

Per-call rows unchanged. Outside the detach count, as before:
`makeCitationDefaultEngineConfiguration`, `makeCitationEngineArtifact` and
`makeCitationSixFormArtifact` keep their raw-input snapshots (separately
callable entry points with raw-input tests).

| Run | Load average (1/5/15 min) | Calls 1 to 10 | Total | Node call 1 |
| --- | --- | --- | --- | --- |
| Round 3 | 15.2 / 33.5 / 41.8 at start, 10.1 / 28.9 / 39.7 at end | 8991, 1942, 1814, 3038, 2336, 1873, 8885, 4144, 1715, 1774 | 36.5 s | 14027 |

Round-3 checks: `CitationCanonicalFullSpan` 12/12 twice; the engine layer,
default configuration, engine resolution, corpus, artifact, extraction report,
captured cleaner plan and ownership tests (4/4, one new `ownedDerive` case), and
the 24 other test files that build the default engine, each run on its own: all
pass. `package-verify --quick`, `lint:laws` (effect-fn 0), fallow audit vs
`origin/main` (0 introduced), `docgen:local`, biome, typecheck and effect-vitest
(0 introduced, 0 resolved) pass.

## Round 4 (independent review of `2fd1c66ea55..d7659d584cd`)

One commit on top of `48d2876c4c1` (see the report for the SHA).

- The extractor's returned report shared the installed deadlines. Its
  `limits` object was already a fresh one, but the `Duration` instances inside
  it were the boundary-owned ones every request reads, so a caller mutating
  `report.limits.extractDeadline.value.millis` changed the installed policy
  (corrected in round 5). The report now carries its own per-request policy
  snapshot (`captureCitationOperationPolicy`, a report copy and not a
  configuration detach, so it is outside the detach count). New test:
  `CitationExtractorControls` › "keeps installed limits when a caller mutates a
  returned report". Only its `extractDeadline.value.millis` half detects the
  leak; the `tokens` half mutates a number on the already-fresh object and
  passes with or without the fix. clean, resolve and annotate
  already returned per-request snapshots; engineArtifact, vocabularyVersion and
  identities reach callers only as strings.
- Tautological refusal tests deleted and real boundary tests added (decision
  "Delete the tautological configuration refusal tests and test the real
  boundaries"): 278 tests before, 270 after in the touched files (14 deleted,
  6 added). The boundary tests assert `CitationInputError` for `extract` from
  CitationEngineLive, the default engine and the extractor, with no child
  process started.
- `ownedStruct` takes a schema class and rejects an empty field record at the
  type level; the `ownedDerive` and `ownCitationConfiguration` JSDoc state their
  real preconditions. An identity walk shows owned engine, default-engine and
  extractor configuration share no object or buffer with the caller's input.
- Reference patterns are authenticated once per installed call site, by
  `verifyCitationReferencePatternConfiguration`; install keeps only the
  rejection fingerprint. Install relies on a verified input: true for every
  production caller (both go through `ownCitationStageCall` with this verify
  step), not enforced by the type. The per-request authentication replay is removed (it replayed a
  success verify had already established).

| Engine construction | Metadata-operation installs | Configuration detaches | Tokenizer builds | Regex evaluator installs | Regex evaluations | Child processes | Process owners | Diff/Xml workers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A4, round 4 | 16 | 1 | 1 | 26 | 0 | 0 | 1 | 0 |

Per-call rows unchanged (0 installs, 0 detaches, 0 tokenizer builds, 0
evaluator installs; 291 evaluations and 291 child processes over ten calls),
asserted by `CitationCanonicalFullSpan` (12/12, twice, 55.6 s and 62.5 s at
load 5).

Round-4 checks: every Citation test file (233) on its own, all pass first time;
`package-verify --quick`, `lint:laws`, fallow audit vs `origin/main` (0
introduced), `docgen:local`, biome, typecheck and effect-vitest (0 introduced,
0 resolved; one row removed with a deleted test) pass. Coverage runs on hosted
CI.

## Round 5 (review pass 2 of `d0935d28279`)

- Rule coverage after the round-4 deletions: four custom schema rules had lost
  their only tests and now have schema-level tests (`ProfileNames`,
  `ExtractorIdentity`, `CitationMetadataYearBound`, and the `GroupIdentifier`
  key rule, which a v4 `S.Record` applies by dropping the key, not by
  refusing). The engine boundary test gains an incoherent descriptor case:
  `CitationInputError` for `extract`, no capture name in the encoded or
  printed error, no child process. Table in decision "Delete the tautological
  configuration refusal tests and test the real boundaries".
- Default path order: the base ran own, backend-kind check, admission owners,
  asset assembly, document services, then `make`, which decoded the
  assembled `CitationEngineConfiguration`. Round 3 had moved the
  configuration's validation ahead of the document services and used the
  throwing `CitationEngineConfiguration.make`, which turns an invalid
  assembly into a defect where the base returned `CitationInputError`. The
  one `ownedDerive` now runs assets, services, then
  `CitationEngineConfiguration.makeEffect` mapped to `CitationInputError`,
  the base's order and failure.
- Instrumentation: on the default path the install no longer runs under a
  nested `Citation.makeEngine` span. `makeDefault` calls the internal
  `install` directly, so the engine stages run under
  `Citation.makeDefaultEngine` › `Citation.installEngine`; `make` keeps
  `Citation.makeEngine` › `Citation.installEngine`. The generated
  instrumentation catalog (`standards/instrumentation-catalog`) records the
  span set: A4 removed the per-stage copy and decode spans and adds
  `Citation.ownConfiguration`, `Citation.installEngine`,
  `Citation.installOwnedStage`, `Citation.installReferencePatterns`, the
  per-stage `verify*Configuration` spans and
  `Citation.checkSelectionBindingBudgets`.

Round-5 checks: the four touched test files, the ownership and engine layer
tests and the 21 other test files that build the default engine, each run on
its own: 28/28 pass, including `CitationCanonicalFullSpan` (12/12, counts
unchanged) and `CitationEngineLayer` (15/15). `package-verify --quick`,
`lint:laws` (effect-fn 0), fallow audit vs `origin/main` (0 introduced),
`docgen:local`, biome, typecheck and effect-vitest (0 introduced, 0
resolved) pass.
