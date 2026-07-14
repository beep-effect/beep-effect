# Deterministic Doc-Structure Extraction — Brief

This is the post-align shape draft. Items labeled **proposed — ratify at shape
sign-off** are the remaining shape choices, not reopened align decisions.

## Problem

Malpractice-grade legal workflows cannot treat a plausible parse as a fact.
They need deterministic, versioned recognition rules whose output can be
reproduced against the exact source artifact, independently verified, and
rejected with a typed reason when evidence is absent, ambiguous, stale,
malformed, unsupported, low quality, or outside a rule's coverage.

The first product need is concrete: the patent deadline spine must know whether
an office action is `NON-FINAL` or `FINAL` and must receive its `SHORTENED
STATUTORY PERIOD` block. Those two evidence-backed facts feed the deadline
rules module in
[`goals/law-docketing-patent-spine`](../../goals/law-docketing-patent-spine/README.md).
Today the docketing manifest names only M365 and reliability dependencies; at
graduation this packet must add the explicit structure-extraction consumer
edge rather than leaving the integration implicit.

This packet therefore owns non-citation legal structure recognition as
law-practice product language. It composes verified anchoring, file processing,
Pandoc AST input, the separate citation engine, and unchanged epistemic
admission contracts.

## Appetite

**Proposed — ratify at shape sign-off:** one focused goal packet for a single
office-action rule family and docketing intake adapter, bounded to:

- one representative office-action fixture plus hostile negative/duplicate/
  drift/quality fixtures;
- versioned recognition of the paired finality declaration and shortened
  statutory-period block;
- exact verified anchors, typed abstention, candidate construction, and the
  docketing intake seam; and
- package-local tests plus the repo's normal quality proof.

No additional office-action families, contract structures, streaming, LLM
refinement, court-PDF layout work, or repo-wide confidence cleanup fit this
appetite. Those require separately approved follow-ons.

## Solution Sketch

```text
fixture office action
  -> law-practice OA rule family v1
  -> paired raw matches: finality + shortened statutory period
  -> GroundedExtraction[] (or equally span-preserving array)
  -> shared verified-anchor contract
  -> law-practice docketing candidates
  -> law-docketing-patent-spine intake
  -> existing admission/approval workflow
```

The rule family is pure and versioned in `packages/law-practice/domain`.
Ports and the extraction-to-candidate workflow live in
`packages/law-practice/use-cases`; server composition, persistence, and the
docketing adapter live in `packages/law-practice/server`. The workflow emits no
candidate unless both required structures survive source verification. It
fails closed with `absent`, `ambiguous`, `unsupported`, `low-quality-source`,
or `rule-not-covered`; stale and malformed evidence fail in the consumed
verified-anchor contract.

Each adopted regex family has a provenance row containing upstream/source,
license, exact disposition, local rule version, and parity fixtures.
AGPL or unknown-license material is clean-room design reference only; it is
never copied or vendored.

### Proposed candidate representation

**Proposed — ratify at shape sign-off:** define a schema-backed law-practice
`DocStructureCandidate` tagged union, initially:

- `OfficeActionFinalityCandidate` — `FINAL | NON-FINAL`, verified evidence,
  rule-family id/version, source identity, and canonical confidence; and
- `ShortenedStatutoryPeriodCandidate` — the recognized period declaration and
  verified evidence, with the same rule/source metadata.

An explicit Effect adapter converts `ReadonlyArray<GroundedExtraction>` into
the candidate union or typed abstention. An equally span-preserving extraction
array may replace `GroundedExtraction[]` only if it satisfies the same adapter
contract. `AnnotatedDocument` and untyped `{nodes,links}` snapshots are not
evidence boundaries.

### Proposed source-artifact identity contract

**Proposed — ratify at shape sign-off:** name the contract
`VersionedSourceArtifactIdentity`. It identifies exactly one source artifact
and coordinate space with artifact id, immutable content digest, source
version, document id, and raw-text reference. A candidate's verified anchor
must prove:

```text
thatArtifact.rawText.slice(startUtf16, endUtf16) === quote
```

Normalization is only a locator. Emitted evidence always returns to the raw
half-open UTF-16 coordinates of that one artifact. OCR/layout-derived text
also carries typed parent/source lineage, transformation/engine version,
coordinate mapping, and quality status/warnings. Until that lineage is stable
and its quality authorizes evidence, its offsets cannot authorize a candidate.
The concrete verified-anchor fields remain owned by
[`citation-verified-span-substrate`](../../goals/citation-verified-span-substrate/SPEC.md);
shape sign-off ratifies the identity this packet requires at its boundary.

## Rabbit Holes

- **Rule versioning and migration:** never reinterpret persisted candidates
  under a newer regex. Retain rule-family id/version and source identity;
  specify replay/supersession behavior in the goal.
- **Precision floors:** docketing is selective prediction. Define labeled
  per-family precision/abstention acceptance before expanding rule coverage.
- **Fixture corpus construction:** include real-form diversity without private
  client text; pin licenses and dispositions; cover duplicates, near-misses,
  malformed periods, Unicode, drift, and page/segment straddle.
- **OCR lineage:** flattened or low-quality OCR cannot mint authority. Coordinate
  lineage and typed quality warnings arrive from file-processing.
- **Confidence adapter gaps:** decode into branded
  `@beep/schema/UnitInterval`. Modeling/NLP's unbranded copy and
  `CitationBase`'s `S.Finite` are owner-routed cross-references, not this
  packet's cleanup.
- **Calibration and cascade:** hand-authored scores are non-calibrated priors.
  LLM refinement waits for labeled outcomes, per-family thresholds, and a
  local privilege-approved path; no-match never triggers escalation.

## No-Gos

- No citation parsing, `eyecite-js` dependency, or second citation hierarchy.
- No new foundation/capability doc-structure package.
- No streaming surface in this appetite.
- No LLM-first extraction and no LLM escalation on regex absence.
- No untyped `{nodes,links}` snapshots or `AnnotatedDocument` evidence handoff.
- No court-PDF engine selection, caption/header-stamp recognition, or layout
  spike; consume file-processing's future qualified input contract.
- No changes to epistemic admission contracts or repo-wide confidence cleanup.
