---
title: "Record #2737's new-file coverage rows at measured values"
date: 2026-11-07
lane: "fix/law-practice-coverage-ep36"
reversal: "Restore package floors by covering the listed worker programs with in-process tests"
---

Context: main's Heavy / Coverage Regression red (ep36) after #2737. The ratchet only reports new-file witnesses for a metric when no baseline file row already fails that metric, so the 12 regressed per-file rows hid the debt of #2737's 61 new `@beep/law-practice-server` files that have no baseline identity and are below 100%. Much of their code runs only in child-process worker programs or in the coverage-excluded `test/integration` suite.

Decision (orchestrator ruling, option B): restore every pre-existing row with tests (all 12 briefed rows plus `RuntimeDictionary.ts` meet their committed floors), cover the cheap in-process refusal paths, then record the new-file rows at measured values with `bun run coverage -- --filter=@beep/law-practice-server --write-baseline`. No pre-existing per-file row gained an uncovered unit; 26 existing percentages moved only because #2737 shrank those files while their uncovered counts stayed equal. Package totals moved by the new-file remainder only: functions 97.79 -> 95.52, lines 99 -> 98.36, statements 98.84 -> 97.48 (branches rose 93.67 -> 94.42).

Owner of the remainder: the citation-extraction-engine lane. Largest remainders: `DiffWorkerProgram.ts` (0%, 14 functions / 32 lines), `XmlWorkerProgram.ts` (0%, 11 / 23), the four `*.entry.ts` / `*.node.entry.ts` launchers (0%), `DiffWorker.ts` (8 functions), `DiffKernel.ts` (6), `CanonicalSource.ts` (5), `GeneratedReferences.ts` (5), `OccurrenceProjection.ts` (4), `XmlBalanceKernel.ts` (4). Several remaining callbacks map errors that cannot occur (hashing, re-encoding just-decoded values, authenticated-kernel protocol violations) and are candidates for deletion rather than tests.

Recorded rows below 100% (path relative to packages/law-practice/server):

| File | Lines | Statements | Branches | Functions | Uncovered (L/S/B/F) |
| --- | --- | --- | --- | --- | --- |
| `src/CitationEngine/CitationEngine.layer.ts` | 94.44 | 90.47 | 100 | 75 | 1/2/0/2 |
| `src/internal/Citation/AnnotationAssembly.ts` | 100 | 97.1 | 93.33 | 100 | 0/2/2/0 |
| `src/internal/Citation/AnnotationCallback.ts` | 94.44 | 90.47 | 100 | 60 | 1/2/0/2 |
| `src/internal/Citation/AnnotationOperation.ts` | 100 | 88.88 | 100 | 66.66 | 0/1/0/1 |
| `src/internal/Citation/AnnotationPreparation.ts` | 91.66 | 92.59 | 71.42 | 100 | 2/2/2/0 |
| `src/internal/Citation/AnnotationSkip.ts` | 100 | 93.33 | 75 | 100 | 0/1/1/0 |
| `src/internal/Citation/AnnotationTemplate.ts` | 99.1 | 96.5 | 93.5 | 95.83 | 1/5/5/1 |
| `src/internal/Citation/AnnotationWrap.ts` | 96.29 | 84.37 | 60 | 57.14 | 1/5/4/3 |
| `src/internal/Citation/Asset.ts` | 90.9 | 92.3 | 100 | 80 | 2/2/0/2 |
| `src/internal/Citation/CanonicalSource.ts` | 91.42 | 87.5 | 100 | 61.53 | 3/5/0/5 |
| `src/internal/Citation/CaseMetadata.ts` | 98.46 | 97.22 | 100 | 88.88 | 1/2/0/2 |
| `src/internal/Citation/CaseName.ts` | 92.85 | 90 | 90 | 77.77 | 2/3/1/2 |
| `src/internal/Citation/CaseNameSelection.ts` | 96.77 | 94.11 | 100 | 86.66 | 1/2/0/2 |
| `src/internal/Citation/DiffKernel.ts` | 92.2 | 88.17 | 82.75 | 79.31 | 6/11/5/6 |
| `src/internal/Citation/DiffWorker.entry.ts` | 0 | 0 | 100 | 0 | 3/3/0/1 |
| `src/internal/Citation/DiffWorker.node.entry.ts` | 0 | 0 | 100 | 0 | 3/3/0/1 |
| `src/internal/Citation/DiffWorker.ts` | 88.88 | 83.33 | 63.63 | 61.9 | 6/10/4/8 |
| `src/internal/Citation/DiffWorkerProgram.ts` | 0 | 0 | 0 | 0 | 32/34/6/14 |
| `src/internal/Citation/DiffWorkerProtocol.ts` | 96.29 | 91.93 | 81.81 | 90 | 2/5/4/1 |
| `src/internal/Citation/DiffWorkerRpc.ts` | 87.5 | 83.33 | 100 | 66.66 | 2/3/0/3 |
| `src/internal/Citation/DocumentCleanerProtocols.ts` | 96 | 95.76 | 90.38 | 95.83 | 4/5/5/1 |
| `src/internal/Citation/DocumentExtraction.ts` | 98 | 98.18 | 100 | 93.33 | 1/1/0/1 |
| `src/internal/Citation/DocumentServices.ts` | 90.9 | 90.9 | 100 | 50 | 1/1/0/1 |
| `src/internal/Citation/EngineArtifact.ts` | 96.77 | 96.96 | 100 | 80 | 1/1/0/1 |
| `src/internal/Citation/EngineFailure.ts` | 83.33 | 84.21 | 62.5 | 72.72 | 3/3/6/3 |
| `src/internal/Citation/ExtractionEntry.ts` | 95.34 | 93.61 | 90 | 80 | 2/3/1/2 |
| `src/internal/Citation/ExtractionLoop.ts` | 92.18 | 92.85 | 91.3 | 82.35 | 5/5/2/3 |
| `src/internal/Citation/ExtractionSelection.ts` | 100 | 95.76 | 93.84 | 93.33 | 0/5/4/2 |
| `src/internal/Citation/FullExtraction.ts` | 97.91 | 96.36 | 75 | 90 | 1/2/3/2 |
| `src/internal/Citation/GeneratedReferences.ts` | 95.37 | 92.96 | 86.36 | 84.37 | 5/9/6/5 |
| `src/internal/Citation/HelperConfigurations.ts` | 93.75 | 94.11 | 100 | 75 | 1/1/0/1 |
| `src/internal/Citation/HtmlCaseName.ts` | 96.63 | 94.44 | 91.48 | 91.66 | 4/8/4/3 |
| `src/internal/Citation/HtmlDiscovery.ts` | 100 | 96.38 | 83.33 | 94.11 | 0/3/2/1 |
| `src/internal/Citation/HtmlGeometryPreparation.ts` | 96.42 | 93.54 | 100 | 77.77 | 1/2/0/2 |
| `src/internal/Citation/HtmlWorker.node.entry.ts` | 0 | 0 | 100 | 0 | 3/3/0/1 |
| `src/internal/Citation/InputDocument.ts` | 96.72 | 95.52 | 95.45 | 88.88 | 2/3/1/2 |
| `src/internal/Citation/MarkupWorker.ts` | 100 | 98.48 | 83.33 | 96.15 | 0/1/3/1 |
| `src/internal/Citation/NativeJson.ts` | 100 | 100 | 96.66 | 100 | 0/0/1/0 |
| `src/internal/Citation/OccurrenceProjection.ts` | 94.85 | 93.63 | 85.18 | 88.88 | 7/10/8/4 |
| `src/internal/Citation/ReferenceNames.ts` | 94 | 92.3 | 86.36 | 76.92 | 3/5/3/3 |
| `src/internal/Citation/ReferencePatterns.ts` | 96.8 | 96.49 | 100 | 84.61 | 3/4/0/4 |
| `src/internal/Citation/ReferenceTokenExtraction.ts` | 95.77 | 93.75 | 81.81 | 84.61 | 3/5/4/4 |
| `src/internal/Citation/ResolverOperation.ts` | 93.33 | 93.75 | 100 | 80 | 1/1/0/1 |
| `src/internal/Citation/SemanticExtraction.ts` | 96.42 | 96.66 | 83.33 | 100 | 1/1/1/0 |
| `src/internal/Citation/SemanticProjection.ts` | 100 | 97.33 | 90.9 | 93.33 | 0/2/2/2 |
| `src/internal/Citation/SemanticVocabulary.ts` | 93.33 | 87.17 | 75 | 75 | 2/5/3/3 |
| `src/internal/Citation/SourceAnnotation.ts` | 98.33 | 93.93 | 92 | 86.66 | 1/4/2/2 |
| `src/internal/Citation/SourceCleaning.ts` | 95 | 95.34 | 77.77 | 100 | 2/2/2/0 |
| `src/internal/Citation/SourceDocument.ts` | 96.55 | 93.33 | 100 | 80 | 1/2/0/2 |
| `src/internal/Citation/SourceExtraction.ts` | 94.59 | 94.59 | 100 | 80 | 2/2/0/2 |
| `src/internal/Citation/SourceRequest.ts` | 100 | 97.01 | 93.33 | 100 | 0/2/2/0 |
| `src/internal/Citation/SourceResolution.ts` | 90.69 | 90.9 | 85.71 | 80 | 4/4/2/2 |
| `src/internal/Citation/TokenizedExtraction.ts` | 97.29 | 95.45 | 100 | 86.66 | 1/2/0/2 |
| `src/internal/Citation/VerifiedExtraction.ts` | 97.77 | 95.91 | 93.33 | 92.3 | 1/2/2/1 |
| `src/internal/Citation/XmlBalanceKernel.ts` | 94.28 | 88.37 | 83.33 | 77.77 | 2/5/2/4 |
| `src/internal/Citation/XmlWorker.entry.ts` | 0 | 0 | 100 | 0 | 3/3/0/1 |
| `src/internal/Citation/XmlWorker.node.entry.ts` | 0 | 0 | 100 | 0 | 3/3/0/1 |
| `src/internal/Citation/XmlWorker.ts` | 85.18 | 77.41 | 12.5 | 71.42 | 4/7/7/2 |
| `src/internal/Citation/XmlWorkerProgram.ts` | 0 | 0 | 0 | 0 | 23/26/6/11 |
| `src/internal/Citation/XmlWorkerProtocol.ts` | 96.77 | 94.44 | 83.33 | 83.33 | 1/2/1/1 |
| `src/internal/Citation/XmlWorkerRpc.ts` | 92.85 | 87.5 | 50 | 75 | 1/2/1/2 |
