---
title: Full citation corpus replays run on bun only, one integration file per range or runtime
date: 2026-11-23
reversal: Add "node" back to each replay's runtime list and merge the range files into one integration file per corpus; regenerate vitest.integration.shards.json and delete this file and its pointers.
governs:
  - test/integration/CitationCanonicalExtraction.test.ts#RANGE
  - test/integration/CitationCanonicalExtractionRange2.test.ts#RANGE
  - test/integration/CitationCanonicalExtractionRange3.test.ts#RANGE
  - test/integration/CitationCanonicalExtractionRange4.test.ts#RANGE
  - test/integration/CitationCanonicalExtractionRange5.test.ts#RANGE
  - test/integration/CitationCanonicalExtractionRange6.test.ts#RANGE
  - test/integration/CitationCanonicalParserOperations.test.ts#RANGE
  - test/integration/CitationCanonicalParserOperationsRange2.test.ts#RANGE
  - test/integration/CitationCanonicalRemainingExtraction.test.ts#RANGE
  - test/integration/CitationCanonicalRemainingExtractionRange2.test.ts#RANGE
  - test/integration/CitationRegexTranslator.test.ts#kind
  - test/integration/CitationRegexTranslatorNode.test.ts#kind
enforcedBy: []
---
The full canonical, metadata and regex corpus replays in `test/integration` run on bun only since 2026-11-09 (group G7 of goals/citation-extraction-engine/decisions/2026-11-09-delete-redundant-law-practice-server-citation-tests-and-re-baseline-coverage.md). Node coverage of the engine comes from `integration/CitationEngineCorpus.test.ts` and `integration/CitationCanonicalTokenizer.test.ts` (both runtimes), the U2 node slices (CitationExtractionLoop, CitationCanonicalFullSpan, PageCorrection, PinSpan, ParsedEquality) and the kept worker scenes (CitationDiffWorker, CitationXmlWorker, CitationHtmlGeometryPreparation); the unit twins of these corpora run on bun only.
The canonical extraction table, the parser-operation groups and the remaining-extraction groups are split into contiguous ranges, one integration file per `RANGE`, and native regex translation into one file per runtime (`kind`), so no file exceeds a hosted integration partition's budget. Every row still replays with full=true; `test/CitationCanonicalExtractionRanges.test.ts` asserts the ranges are disjoint and their union is the whole table or every group.
The eight whole-corpus replays with no range split carry the same pointer above their `it.layer` suite, which has no top-level declaration to anchor: `test/integration/CitationCanonicalAnnotationWorkflow.test.ts`, `CitationCanonicalCourts.test.ts`, `CitationCanonicalReferenceMarkup.test.ts`, `CitationFullLawMetadata.test.ts`, `CitationJournalMetadata.test.ts`, `CitationRegexBoundaries.test.ts`, `CitationRegexCaseFlags.test.ts` and `CitationVerifiedExtraction.test.ts`. Reversing this decision adds "node" back to each of them too.
Reason: Heavy Test Integration ran 99 minutes as one task over the full replays on both runtimes.
Rejected: replaying each full corpus on both runtimes; one integration file per corpus.
Accepted limit: node coverage of these corpora is the slice set above, not a full replay.
