# Citation Schema Disposition

This is the binding migration policy for the existing
`packages/law-practice/domain/src/values/` citation surface. The current models
were useful exploration scaffolding and frequently mirror `eyecite-ts` types,
but they are not a compatibility contract.

A repo-wide source scan on 2026-07-29 found citation-surface consumers in the
law-practice domain tests/dtslint and owning model documentation, but no
production consumer requiring shape compatibility. The package is private.
Future execution must repeat that scan before deletion and route any newly
discovered consumer through the same migration.

## Target boundaries

### Semantic legal values

`Citation` is a tagged union of legal meanings. Members contain fields needed
to identify and express the authority—such as reporter/volume/page, title/
section, parties, court, date, and pincite—but no extraction telemetry or raw
document occurrence state.

`FullCitation` and `ShortFormCitation` are derived subsets of the same tagged
union. Their tag literals are the only source of citation-type truth.

### Occurrence evidence

`CitationMention` composes:

- stable `CitationId`;
- one semantic `Citation`;
- canonical verified raw-source anchor and exact matched text;
- optional component anchors;
- occurrence signal, footnote zone, grouping membership, and typed warnings;
- evidence confidence only when the producer actually makes a confidence
  assertion.

The verified-span prerequisite owns source identity, UTF-16 coordinates,
normalization mapping, re-anchor/drift, and durable locator semantics.

### Resolution and document structure

`CitationResolution` is a tagged
`Resolved | Ambiguous | Unresolved` schema. It references mention/authority IDs,
uses bounded confidence when present, and carries case-specific diagnostics.

`CitationDocument` owns mention order, parallel/string groups, authority
resources, reference relationships, and resolution results.

### Operations and diagnostics

`CitationEngineInput` owns source text/identity and extraction options.
`CitationEngineReport` owns stage timings, pattern counts, tokenizer/filter
statistics, regex diagnostics, and vocabulary/anchor artifact versions.

## Mandatory removals and replacements

| Existing value | Final disposition | Required replacement/reason |
| --- | --- | --- |
| `CitationBase` | remove as public model | It incorrectly mixes semantic, occurrence, grouping, footnote, warning, confidence, and telemetry fields. Compose target schemas instead. |
| `CitationType` | remove standalone truth | Derive from `Citation` tags/LiteralKit helpers. |
| `FullCitationType` | remove standalone truth | Derive from `FullCitation` member tags. |
| `ShortFormCitationType` | remove standalone truth | Derive from `ShortFormCitation` member tags. |
| `ContextOptions` | move/delete | Rebuild as fields of schema-defined `CitationEngineInput`; it is not a law-practice value object. |
| `ResolutionResult` | replace | Use stable-ID tagged `CitationResolution` outcomes; remove array indices and optional failure bags. |
| `Span` | remove from public law-practice API | Use the canonical verified raw anchor; keep cleaned/intermediate coordinates internal to the pipeline only. |
| `TransformationMap` | remove from public law-practice API | Consume the verified-span normalization map; an engine-local adapter may exist only if the prerequisite does not expose an internal processing shape. |
| `ComponentSpan` family | replace | Compose named citation-component anchors over the canonical source-anchor primitive; do not maintain fourteen duplicated coordinate classes. |
| `Segment` | internalize or delete | Cleaning implementation detail, not legal domain value. |
| `SegmentMap` | internalize/subsume | Prefer the prerequisite mapping contract; do not export duplicate durable-source semantics. |
| `DurableLocator` | delete/subsume | Verified-span prerequisite owns source identity, durability, and re-anchor behavior. |
| `DurableLocatorOptions` | delete/subsume | Move any still-needed operation options to the prerequisite/engine boundary. |
| `SurroundingContext` | derive/move | A projection from source plus mention anchor, not durable citation truth. |

`CitationBase.confidence: S.Finite` is not merely changed to `UnitInterval`.
It is removed from semantic citations. Any surviving evidence/resolution
confidence uses the shared branded `UnitInterval` at the assertion it qualifies.

## Rebuild and retain the concept

These concepts remain useful but their current field shapes and files are not
preserved.

| Existing value | Target ownership/shape |
| --- | --- |
| `Citation` | Rebuild as canonical semantic tagged union; split the current monolithic file as needed for comprehensibility. |
| `CitationId` | Retain stable branded concept; assign at mention construction and use across groups/resolution. |
| `CitationSignal` | Retain as occurrence/document relationship evidence, not a base field inherited by semantic citations. |
| `CitationWarning` | Rebuild as a finite typed union with case-specific payloads; no free-form generic warning bag. |
| `CourtInference` | Rebuild as vocabulary-backed evidence referencing stable court/reporter IDs and artifact version. |
| `PinciteInfo` | Retain parsed locator semantics where canonical/extension fixtures prove them. |
| `ParentheticalType` | Retain only source-backed finite variants and derive related helpers from its schema. |
| `HistorySignal` | Retain source-backed legal history signal domain. |
| `HistoryLink` | Rebuild around stable authority/mention IDs. |
| `HistoryChain` | Rebuild as document/authority relationship data, not recursively embedded citation copies. |
| `SubsequentHistoryEntry` | Rebuild as legal history semantics referencing stable IDs where it links citations. |
| `CaseGroup` | Rebuild as a `CitationDocument` projection keyed by authority/mention IDs. |
| `ParallelGroup` | Rebuild as ordered mention IDs plus source-supported presentation metadata. |
| `StringCitationGroup` | Rebuild as ordered mention IDs and leading signal; remove per-citation duplicated size/index/group object. |
| `Footnote` | Move to occurrence/document evidence with verified source zone anchors. |
| `StructuredDate` | Retain if canonical/accepted extension models consume it; keep one schema-owned representation. |

## Semantic citation-form candidates

The following are legal-form concepts, not guaranteed legacy APIs. Reauthor a
form as a semantic tagged-union member only when it is:

1. canonical official-eyecite behavior; or
2. an adopted extension with pinned tests, provenance, exact anchors, and
   stable vocabulary integration.

Otherwise delete the provisional form and its exports/tests rather than keeping
an unimplemented promise.

| Existing concept | Source gate |
| --- | --- |
| `FullCaseCitation`, `IdCitation`, `SupraCitation`, `ShortFormCaseCitation` | canonical required |
| Canonical full law/journal, reference, and unknown forms not cleanly represented today | add/rebuild as canonical required |
| `StatuteCitation`, `RegulationCitation` | adopted extension; first-slice 35 U.S.C./37 C.F.R. cases required |
| `JournalCitation` | reconcile with canonical `FullJournalCitation` rather than duplicate |
| `AnnotationCitation` | extension audit |
| `CanonCitation` | extension audit |
| `ConstitutionalCitation` | extension audit |
| `DocketCitation` | extension audit |
| `FederalRegisterCitation` | extension audit |
| `FederalRuleCitation` | extension audit |
| `LegislativeMaterialCitation` | extension audit |
| `LocalOrdinanceCitation` | extension audit |
| `NeutralCitation` | extension audit |
| `PublicLawCitation` | extension audit |
| `RestatementCitation` | extension audit |
| `SessionLawCitation` | extension audit |
| `StateRuleCitation` | extension audit |
| `StatutesAtLargeCitation` | extension audit |
| `TreatiseCitation` | extension audit |
| `TreatyCitation` | extension audit |
| `IdLawCitation`, `DOLOpinionCitation`, `CaseNameCitation` absent from current values | add only if their extension rows become adopted |

Do not retain both donor-specific and canonical names for the same legal form.
Choose the repo semantic name once during the case-level mapping and record the
donor aliases in the capability ledger.

## Unrelated values left unchanged

The citation goal does not remove or redesign these law-practice values merely
because they share the directory:

- `ApplicationNumber`
- `KindCode`
- `OfficeCode`
- `PatentDocumentTriplet`
- `PatentMetadata`
- `PatentNumber`
- `PatentOffice`
- `KgEdgePredicate`
- `KgNodeKind`
- `SeniorityTier`

If `StructuredDate` has non-citation consumers, preserve their contract while
reusing the same schema in citation models.

## Transformation disposition

- Delete `FullCaseCitation.toBlueBook`.
- Add structured `BluebookCitation`.
- Add `BluebookFromFullCitation` as the schema transform used by
  `S.decodeEffect(BluebookFromFullCitation)(citation)`.
- Add `BluebookTextFromBluebookCitation` for rendering and supported parsing.
- Add a lossless structured/wire transform for exact citation round trips.
- Do not add a generic style framework, registry, or second formatter
  abstraction before another style is requested.

The structured Bluebook model must declare which forms/rules it supports. It
cannot claim full manual compliance.

## Migration order

1. Repeat consumer/export scans and freeze the case-level semantic field map.
2. Add target schemas and schema-derived type/tag helpers.
3. Migrate the first-slice extractor/tests to target schemas.
4. Migrate canonical forms and resolution/document relationships.
5. Migrate adopted extensions and transforms.
6. Remove old exports/files and rewrite domain tests/dtslint.
7. Run a final source/barrel scan proving no old mixed or duplicate contract
   remains.

No compatibility aliases, deprecated mirror types, or dual old/new hierarchy
are allowed unless a newly discovered production consumer makes a specific
temporary bridge necessary. Such a bridge requires a dated exception with its
removal test and cannot survive goal close.

## Completion checks

- No public `CitationBase`.
- No semantic citation contains source text/span, telemetry, grouping object,
  footnote location, or generic warning arrays.
- No resolution result references citation array positions.
- No separate type literal list can drift from union tags.
- No law-practice locator/span contract duplicates the prerequisite.
- Every surviving citation form maps to canonical or adopted-extension cases.
- Every public schema has meaningful annotations, schema-derived guards/
  equivalence/arbitrary where applicable, and docgen-clean examples.
