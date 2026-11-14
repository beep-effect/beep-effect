# Slice A4: configuration owned once at the engine boundary

Recorded 2026-11-13 on `perf/citation-owned-configuration`, based on
`origin/main` at `2fd1c66ea55` (A3 merged as #3282).

Status: in review with two stops (decisions below). The per-call rows are
unchanged and the construction row moves from 10 configuration detaches to 2,
not to the design's 1.

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

- "Stop the default engine at two owns: engine-loaded assets cannot be minted
  owned" (stop; proposed reshapes inside).
- "Stop pattern fingerprints and artifact hashes at each installed call site"
  (stop; every authentication kept).
- "Keep leaf helper argument decoding and the per-request reference builder
  decode" (scope).
- "Assemble owned child configuration with ownedStruct".
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
| Report-mutation tests (2026-11-07) | `CitationSourceCleaning`, `CitationSourceAnnotation`, `CitationResolverBoundary`: pass, assertions unchanged |
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
