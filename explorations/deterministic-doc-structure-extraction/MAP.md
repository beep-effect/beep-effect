# Deterministic Doc-Structure Extraction — Map

This is the graduation fan-out map. Candidate boundaries marked gated or
deferred do not enter the graduated first goal's appetite.

## Candidate Goal Packets

| Slug | Mission | Depends on / gate | Existing capabilities and NET-NEW work |
| --- | --- | --- | --- |
| [`law-doc-structure-oa-slice`](../../goals/law-doc-structure-oa-slice/README.md) **GRADUATED 2026-07-14** | Extract the paired office-action finality declaration and shortened-statutory-period block, verify exact raw anchors, and deliver typed candidates to the docketing intake seam. | **Blocked by** `goals/citation-verified-span-substrate` P0/P1; consumed by `goals/law-docketing-patent-spine`. | Reuse law-practice spans, langextract extractions, provenance anchors, canonical confidence, and JS regex-index primitives. **NET-NEW:** OA rule family/versioning, abstention codes, candidate union/adapters, docketing intake adapter. |
| `law-doc-structure-oa-follow-ons` **GATED** | Add separately validated OA families such as rejection sections and claim-status listings. | First slice accepted; labeled fixtures and per-family precision floors. | Reuse first-slice contracts. **NET-NEW:** each rule family, version, parity corpus, and candidate member. |
| `law-doc-structure-contracts` **GATED** | Recognize approved defined-term, amendment, party, and contract-structure families. | Shape-approved appetite after OA proof; named consumer and labeled corpus. | Reuse first-slice contracts and Pandoc AST where useful. **NET-NEW:** contract-language rule families and consumer adapters. |
| `law-doc-structure-streaming` **DEFERRED** | Expose extraction progress only for a named product consumer. | Named consumer required; Q7 doctrine is binding. | **NET-NEW:** schema-backed span-preserving `Complete` plus presentation-only `Partial`; never `LangExtractResult` verbatim or `AnnotatedDocument`. |
| `law-doc-structure-calibration-cascade` **DEFERRED** | Calibrate per-family thresholds on labeled candidate outcomes, then evaluate local privilege-approved LLM refinement. | Labeled outcomes and approved local path required. | Reuse typed abstention/candidates. **NET-NEW:** calibration evaluation, thresholds, and cascade policy implementation. |

## Re-entry Points

The four non-graduated rows above are re-entry points under the repository's
reopen-at-`decompose` convention. Reopen when
`law-doc-structure-oa-slice` records first-slice acceptance; each row still
retains its own named consumer, corpus, calibration, or streaming gate.

## Cross-Packet Contracts

| Packet | Relationship | Contract carried here |
| --- | --- | --- |
| [`citation-grounding-hallucination-guard`](../citation-grounding-hallucination-guard/README.md) | Consumed citation engine | All legal citations remain in its queued Effect-native engine; this packet adds no citation dependency or hierarchy. |
| [`goals/citation-verified-span-substrate`](../../goals/citation-verified-span-substrate/README.md) | Blocking substrate | P0/P1 must supply verified raw anchors, normalization maps, UTF-16 conversion, ambiguity, drift, and straddle over direct span-preserving extractions. |
| [`goals/file-processing-capability`](../../goals/file-processing-capability/README.md) | Input producer | Identified extracted text, stable source-coordinate provenance/lineage, and typed quality warnings; owns OCR/layout engines and any Poppler decision. |
| [`goals/pandoc-ast-foundation`](../../goals/pandoc-ast-foundation/README.md) | Structural input | Product-neutral Pandoc AST may seed legal rules without owning their semantics. |
| [`goals/law-docketing-patent-spine`](../../goals/law-docketing-patent-spine/README.md) | First consumer | Docketing intake consumes finality and shortened-period candidates; graduation adds the currently missing manifest dependency edge. |

## Capability Check

| Need | Exact capability path | Disposition |
| --- | --- | --- |
| Clean/original legal spans | `packages/law-practice/domain/src/values/Span/Span.model.ts` | Reuse the half-open span value. |
| Segment mapping | `packages/law-practice/domain/src/values/SegmentMap/SegmentMap.model.ts` | Reuse the clean/original mapping pattern where compatible with the verified-anchor substrate. |
| Span-bearing extraction | `packages/foundation/capability/langextract/src/Extraction/index.ts` | Consume `GroundedExtraction[]` through an explicit adapter; never use `AnnotatedDocument` as evidence. |
| Raw evidence anchor | `packages/foundation/modeling/provenance/src/TextAnchor.ts` | Reuse through the stronger verified construction supplied by `citation-verified-span-substrate`. |
| Canonical confidence | `packages/foundation/modeling/schema/src/UnitInterval.ts` | Decode at every evidence/admission boundary; do not absorb unrelated cleanup. |
| Generic NLP modeling | `packages/foundation/modeling/nlp` | Reuse generic bricks only; legal rules stay in law-practice. |
| Regex capture offsets | ECMAScript `String.prototype.matchAll` / `RegExp.prototype.hasIndices` (`d` flag) | Runtime primitives exist; no repo char-offset extractor exists. **NET-NEW:** a focused Effect/schema-first adapter in the legal rule family. |

## Sequencing

1. Wait for `citation-verified-span-substrate` P0/P1 to freeze and implement
   the source/offset contract.
2. Graduate and execute `law-doc-structure-oa-slice`; at graduation add its
   edge to the docketing spine manifest.
3. Admit follow-on OA or contract rule families only after the first slice has
   a labeled acceptance result and each follow-on has a named consumer.
4. Keep court-PDF structures behind file-processing's layout spike. Keep
   streaming and calibration/cascade deferred behind their explicit gates.

## First Vertical Slice

Given a versioned office-action fixture, rule family v1 recognizes exactly one
finality declaration and one shortened-statutory-period block. Each raw
half-open UTF-16 span is verified against one identified source artifact. The
adapter emits the two schema-backed law-practice candidate variants to the
docketing intake seam. Negative fixtures prove typed closed outcomes for
absence, duplicate/ambiguity, unsupported or uncovered rules, low-quality
source, stale identity, malformed offsets, and failed raw-slice equality.

## Open Risks Inherited From The Brief

- Freeze rule replay, migration, and supersession semantics before persistence.
- Set per-family precision floors from labeled fixtures, not hand-authored
  confidence priors.
- Build a license-safe, non-client fixture corpus with parity dispositions.
- Require typed OCR/layout lineage and quality before derived offsets authorize
  candidates.
- Keep branded confidence adapters explicit while owner goals repair other
  schemas.
