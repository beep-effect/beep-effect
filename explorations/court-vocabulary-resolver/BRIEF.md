# Court Vocabulary Resolver — Brief

## Problem

Court and reporter identity are the vocabulary substrate beneath citations,
docketing, and the IP-law knowledge graph, but that substrate is absent today.
Consumers are already ahead of it: the citation union in
`packages/law-practice/domain/src/values/Citation/Citation.models.ts` carries
reporter normalization and an `inferredCourt`, while the repo has neither a
versioned court/reporter vocabulary nor an offline court-string resolver with
stable public IDs.

Without a canonical substrate, each consumer is pushed toward ad-hoc strings,
lossy local enums, hosted lookups, or private copies of upstream tables. Those
choices make citations hard to join, make upstream drift invisible, and put the
knowledge graph and citation engine at risk of inventing competing identities.

## Appetite

**Proposed — ratify at shape sign-off:** fund two focused goal packets. The
first establishes the court + reporter artifact and stable-ID contract; the
second ports and proves the deterministic resolver. Keep fuzzy ranking and SKOS
outside that appetite unless separate calibration/evidence clears their gates.
Do not absorb sync-engine redesign, hosted enrichment, citation extraction, or
KG-node modeling to make the core work fit.

## Fat-Marker Solution Sketch

```text
pinned courts-db + reporters-db commits
                  |
                  v
SyncDataToTs public targets (HTTP + SHA-256; deterministic rendering)
                  |
                  v
package-private checksummed artifacts + provenance/version sidecars
                  |
                  v
law-practice stable CourtId/ReporterId + canonical vocabulary + lookup APIs
                  |
                  v
pure offline court-string resolver
                  |
                  +--> citation-extraction-engine
                  +--> docketing / law-practice consumers
                  +--> ip-law-knowledge-graph identity references
```

Goal 1 ingests courts-db and reporters-db together. Its P0 proves the pinned
source assembly contract: identify templated inputs versus rendered releases,
render deterministically, and prove record and stable-ID counts. Generated
artifacts record source identity, retrieval date, checksum, artifact version,
and refresh command. Refresh detects and reports drift through a reviewable
diff; it never silently changes runtime data.

Raw records remain package-private in
`packages/foundation/primitive/data/src/generated/`. Cross-package consumers see
only named law-practice domain schemas and lookup APIs: stable `CourtId` and
`ReporterId`, source-faithful court dimensions (using collision-free names such
as `CourtHierarchyLevel`), canonical reporters-db `cite_type`, provenance, and
explicit projections.

**Proposed — ratify at shape sign-off: stable-ID lifecycle.** An issued public
ID is never reassigned or removed from the compatibility surface. Upstream
deletions become tombstones; renamed or merged records retain aliases and point
to a canonical successor without breaking historical references; reused
abbreviations remain contextual aliases rather than IDs; date-split rows receive
distinct stable IDs with explicit effective ranges. Refresh reports every
addition, deletion, alias change, merger, reuse, and date split for review.

**Proposed — ratify at shape sign-off: artifact compatibility.** Publish one
court/reporter artifact-version identifier and a machine-readable compatibility
contract exposed by the public vocabulary API. Additive rows/aliases are
compatible; ID reassignment, semantic reuse, removal without tombstone, or an
incompatible schema/projection change requires a new incompatible artifact
version. `citation-extraction-engine` records or checks this version rather than
depending on raw generated files.

Goal 2 ports pinned courts-db behavior into a pure Effect resolver. Its result is
a court-specific typed value carrying stable `CourtId`, `matchClass`,
`matchedSpan`, `alternatives`, `sourceArtifactVersion`, and explicit
`ambiguity`. Resolver
facts must not disappear into untyped `GroundedExtraction.attributes`. Runtime
is offline and immutable. A P0 spike decides regex execution from full-corpus
compatibility/parity and adversarial timing evidence; a separate P0 spike bounds
the lossy `CourtInference` projection and optional CourtListener crosswalk.

## Rabbit Holes

- **Regex parity and ReDoS:** RE2 safety is attractive, but unsupported
  constructs can violate the pinned behavior contract. Scan every pattern,
  prove fixtures, and allow only a bounded, evidenced hybrid.
- **Upstream churn:** deletions, mergers, aliases, reused abbreviations, and
  date-split courts can break joins unless the stable-ID and drift policies are
  enforced by generation.
- **Templated source assembly:** courts-db inputs include templates and inherited
  data. P0 must establish which source files are authoritative and prove
  deterministic rendering with record/ID counts.
- **Domain-name collisions:** existing `CourtInference`, `CourtLevel`, and
  `CourtJurisdiction` are lossy citation inferences, not names for the richer
  source taxonomy.
- **Crosswalk non-isomorphism:** reporters-db strings and CourtListener
  composite/integer enums do not map perfectly. Any interop crosswalk is pinned,
  tested, optional, and never decode authority.
- **License edges:** courts-db/reporters-db material is BSD-2 and belongs in the
  single root notice. CourtListener AGPL facts may be re-expressed but its code
  and taxonomy expressions are not transcribed. seal-rookery's data license is
  unknown, so it remains reference-only.
- **Fuzzy metric drift:** fuzzy ranking is calibration-gated; full Levenshtein,
  token-sort, and other similarity functions cannot share thresholds.

## No-Gos

- No hosted CourtListener resolution or runtime network dependency.
- No citation tokenization, extraction, grouping, orchestration, or citation
  resolution; the queued eyecite port owns those concerns.
- No abstract court/jurisdiction KG nodes; `ip-law-knowledge-graph` owns them.
- No sync-engine redesign; add targets to the existing mechanism.
- No CourtListener API client or hosted enrichment in this vertical.
- No fuzzy matching in the core resolver.
- No CourtListener taxonomy transcription or CourtListener enum as authority.
- No public raw generated tables and no runtime mutation of generated data.
- No hand-authored SKOS taxonomy; any later SKOS surface is derived.
