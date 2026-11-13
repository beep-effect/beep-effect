# Slice A3: stage tree, tokenizer and regex evaluators installed once

Recorded 2026-11-13 on `perf/citation-hoist-installs` in lane
`beep-effect-worktrees/citation-install-once-a3`, based on `origin/main` at
`36143773565` (A2 merged as #3265).

## What moved

- **Stage tree.** Every parent stage installs its children in its own install
  body and closes over their methods: SourceExtraction, VerifiedExtraction,
  SemanticExtraction, ExtractionEntry, DocumentExtraction (tokenized extraction
  and input document), TokenizedExtraction (tokenizer and loop) and
  ExtractionLoop (full, reference, generated, selection). FullExtraction already
  installed CaseMetadata, FullLaw and Journal once in its own body; those are now
  installed once per engine because FullExtraction is. `makeCitationMetadataStage`
  passes the runtime to `own`, and `ownCitationStageCall` lets a stage copy its
  configuration and install its call once.
- **Helpers that built regex workers per call** now install once per call site
  and return the per-request call: `installCitationMetadataContextMatch`,
  `installCitationMetadataStringProcessing`, the pin, pre-case and post-case
  helpers, StopWords, CaseNameScan, CaseNameProcess, HtmlCaseName, the plain and
  selected case names, GeneratedReferences (two), HtmlDiscovery (extract through
  `installCitationHtmlGeometry`, annotate through the annotation entry),
  AnnotationWrap and the tokenizer.
- **Regex evaluator.** `makeCitationRegexWorker` became
  `installCitationRegexEvaluator`: limits, runtime, timing, the shared native
  admission, Clock, spawner, Digest, descriptor registry, job preparation and the
  control-frame preflight are engine constants. Each `evaluate` reads
  `CitationInvocation` and starts one physical owner in the invocation Scope;
  each evaluation still spawns one child through the existing owner and lease
  (protocol v2). `bindDescriptors` serves the request-generated descriptors of
  GeneratedReferences.
- **Tokenizer.** `makeCitationTokenizer` already separated install (ordering,
  tries, recipes, editions, evaluator, text plan) from `tokenize`, which holds
  only request state (token objects, produced counter, id list) and reads
  `CitationInvocation`. TokenizedExtraction now installs it once.
- **Install failures keep their request-time placement.** Each stage-tree
  hoist site and the annotation entry's HTML geometry and wrap installs run once
  under `Effect.exit`; the request yields that `Exit` where it used to install
  the stage, so a policy that cannot hold a stage still refuses only the
  requests that reach it, with the same label and order (decision "Surface a
  hoisted install failure where each request used to install the stage").
- **Install-time request reads.** `installedWithoutRequestValues` in
  `CitationEngine.layer.ts` makes an engine stage install that still requires
  `CitationInvocation` or `CitationTextBudget` fail to typecheck. HtmlDiscovery's
  runner captured `CitationTextBudget` at construction; it now reads the
  invocation budget at call time.

## Counts per call (the gate)

The full-span probe, `CitationCanonicalFullSpan.test.ts`, Bun cohort. Before is
the A1/A2 table; after is this slice. The node replay of call 1 matches Bun call 1.

| Call | Installs before → after | Detaches before → after | Tokenizer builds before → after | Regex evaluator constructions before → after | Evaluations (unchanged) | Child processes (unchanged) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 14 → 0 | 8 → 0 | 1 → 0 | 15 → 0 | 70 | 70 |
| 2 | 14 → 0 | 8 → 0 | 1 → 0 | 3 → 0 | 15 | 15 |
| 3 | 14 → 0 | 8 → 0 | 1 → 0 | 3 → 0 | 15 | 15 |
| 4 | 14 → 0 | 8 → 0 | 1 → 0 | 3 → 0 | 24 | 24 |
| 5 | 14 → 0 | 8 → 0 | 1 → 0 | 5 → 0 | 19 | 19 |
| 6 | 14 → 0 | 8 → 0 | 1 → 0 | 5 → 0 | 15 | 15 |
| 7 | 14 → 0 | 8 → 0 | 1 → 0 | 8 → 0 | 65 | 65 |
| 8 | 14 → 0 | 8 → 0 | 1 → 0 | 8 → 0 | 38 | 38 |
| 9 | 14 → 0 | 8 → 0 | 1 → 0 | 3 → 0 | 15 | 15 |
| 10 | 14 → 0 | 8 → 0 | 1 → 0 | 3 → 0 | 15 | 15 |
| **Total** | **140 → 0** | **80 → 0** | **10 → 0** | **56 → 0** | **291** | **291** |

The evaluator column counts `Citation.installRegexEvaluator` after and
`Citation.makeRegexWorker` before; the probe's span map changed with the rename.
What an evaluation constructs per request now is one physical process owner
(`Citation.makeNativeProcessOwner`), which is the per-call process start the
design keeps per request.

Configuration detaches went to 0 per call without any detach being added or
removed: they ran inside the per-request child installs and moved with them
(decision "Let configuration detaches move to engine construction with the
installs"). A4 still owns the `CitationOwned` brand and the nested detaches.

## Construction-time row

Measured with the same probe on one more identical default engine built in the
replay's scope (`citationCanonicalFullSpanConstruction`, asserted by its own Bun
test).

| Engine construction | Metadata-operation installs | Configuration detaches | Tokenizer builds | Regex evaluator installs | Regex evaluations | Child processes |
| --- | --- | --- | --- | --- | --- | --- |
| once per engine | 16 | 10 | 1 | 26 | 0 | 0 |

A1 did not measure construction, so this row has no recorded before. The design
estimated 15 installs, 1 detach after A4 and 12 evaluators; 26 is once per call
site and operation, because each parent installs its own helper chain (for
example CaseMetadata and ReferenceTokenExtraction each install a case-name
selection, which installs HTML and plain case names with their stop-word
cleaners). Construction took 4.7 s on Bun at load average 32 (one sample).

## Results identical

The replay of all ten calls passes with only the count columns of
`citationCanonicalFullSpanWork` changed: 12 of 12 tests on the final code (ten
Bun calls, the node parity call and the construction test). All thirteen
original full-span equalities and the source text hold.

## Sharing judgement, per object

Each object below is now one per engine (or one per parent install) and shared
by concurrent requests.

| Object | Closes over | Judgement |
| --- | --- | --- |
| Regex evaluator | limits, runtime, timing, shared native admission, Clock, spawner, Digest, descriptor registry (a `MutableHashMap` written only during construction), job preparation | Safe. The physical owner (Scope, birth lock, process list, closed flag) is created per evaluation in the invocation Scope, never shared. |
| Tokenizer install | ordering, recipes, editions, evaluator, text plan, regex input | Safe. Token objects (with their semaphore and rows), the produced counter and the id list are created inside `tokenize`. |
| Extractor ordering | initial `RuntimeSet` (semaphore and counters), selection tries | Safe. The initial set is filled at construction; `ordered` copies it, the copy has its own semaphore and counters, and the source's semaphore only serializes the read. The tries are written only during construction. |
| Context matchers, metadata strings, metadata year, pin cleaner, court lookup | patterns, wrappers, token context, evaluator, court table | Safe. No mutable state; the court lookup reads the invocation budget at call time. |
| Case-name scan, process, HTML, plain, selection; stop words | patterns, evaluators, predicates, regex input | Safe. The scan's `Ref` state and every reservation are inside the call. |
| Pre-case, post-case, pin, law, journal, case metadata, reference tokens, full extraction | installed helpers, edition inference, token dispatch, frozen editions | Safe. Per-call state only. |
| Extraction loop, selection, generated references | child stages, Unicode owner, evaluators | Safe. Model list, prior entry and selection counters are inside the call. The reference-pattern builder stays per request. |
| Tokenized, document, entry, semantic, verified, source extraction | child stages, captured children Context, cleaner values and protocols | Safe. No mutable state; the children Context holds engine services that A2 already captured at install. |
| Metadata operations | captured dependency Context (Clock, Digest, Path, spawner, native admission, operation label) | Safe. `run` reads budget and Scope from `CitationInvocation`. |
| HTML discovery runner, HTML geometry | evaluator, regex input | Safe. The placeholder reads the invocation budget at call time. |
| Annotation wrap | evaluator | Safe. Templates capture the request reservation and are built per request. |

Left per request (stop rule, decisions recorded):

| Object | Why it stays per request |
| --- | --- |
| Physical regex process owner | Captures the invocation Scope, a birth lock and its process list. |
| Diff worker, Xml worker (MarkupWorker) | Private semaphores and a Scope-bound native owner; sharing would change process ownership and queueing. |
| Annotation templates | Capture the request reservation at construction. |
| Reference-pattern builder (and its reference names) | Construction reserves fixed fragments on the request budget and checks the enclosing budget; hoisting would change `producedTextUtf16` in the report. |
| Cleaner pipeline in input document | Not in scope; unchanged. |

## Wall time (reported, not a gate)

Bun, per call in milliseconds, workstation.

| Run | Load average (1/5/15 min) | Calls 1 to 10 | Total | Node call 1 | Construction |
| --- | --- | --- | --- | --- | --- |
| A1 run 1 (before) | 24 to 31 | 10697, 3956, 7318, 10104, 5137, 5231, 12516, 8072, 4308, 4283 | 71.6 s | 10634 | not measured |
| A3, first replay (hoisted, before the install-failure deferral) | 7.6 / 9.0 / 8.7 at start | 11171, 2358, 2216, 3485, 2790, 2396, 8883, 5121, 2132, 2129 | 42.7 s | 8180 | not logged |
| A3, final code | 59.9 / 44.1 / 41.3 at start, 65.3 / 52.9 / 45.0 at end | 13913, 2662, 2540, 3836, 3789, 2865, 13330, 10054, 4641, 4413 | 62.0 s | 11932 | 5566 |

The loads differ between rows, so the comparison is indicative only; no remote
worker run was taken for this slice.

## Checks

Per-file coverage, each changed source file measured with focused runs
(`bunx vitest run <tests> --coverage --coverage.include=<src>`), against
`standards/coverage.regression-baseline.jsonc`:

| File | Lines (floor) | Statements (floor) | Branches (floor) | Functions (floor) | Focused tests | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `AnnotationEntry.ts` | 100.0 (100) | 100.0 (100) | 100.0 (100) | 100.0 (100) | own tests | at or above |
| `AnnotationPreparation.ts` | 91.66 (91.66) | 92.59 (92.59) | 75.0 (75) | 100.0 (100) | own tests | at or above |
| `AnnotationWrap.ts` | 96.29 (96.29) | 84.37 (84.37) | 60.0 (60) | 57.14 (57.14) | own tests | at or above |
| `CaseMetadata.ts` | 98.59 (98.46) | 97.43 (97.22) | 100 (100) | 89.47 (88.88) | + full extraction, extraction loop | at or above |
| `CaseName.ts` | 93.93 (92.85) | 91.42 (90) | 90.0 (90) | 81.81 (77.77) | own tests | at or above |
| `CaseNameProcess.ts` | 100.0 (100) | 97.87 (97.82) | 93.93 (93.93) | 96.0 (95.83) | own tests | at or above |
| `CaseNameScan.ts` | 99.33 (99.32) | 98.83 (98.82) | 98.79 (98.79) | 97.22 (97.14) | 20 metadata files | at or above |
| `CaseNameSelection.ts` | 97.22 (96.77) | 94.87 (94.11) | 100.0 (100) | 88.23 (86.66) | own tests | at or above |
| `CitationEngine.layer.ts` | 98.21 (97.29) | 96.55 (95.12) | 100 (100) | 92.3 (84.61) | engine layer, resolution, corpus, report, cleaner plan | at or above |
| `ContextMatcher.ts` | 100.0 (100) | 97.14 (97.14) | 87.5 (87.5) | 88.88 (88.88) | own tests | at or above |
| `DocumentExtraction.ts` | 98.21 (98) | 98.36 (98.18) | 100.0 (100) | 94.11 (93.33) | own tests | at or above |
| `ExtractionEntry.ts` | 100 (100) | 98.11 (98.07) | 100 (100) | 91.66 (91.66) | + semantic extraction, cleaner plan | at or above |
| `ExtractionLoop.ts` | 93.93 (92.18) | 94.44 (92.85) | 91.3 (91.3) | 88.23 (82.35) | own tests | at or above |
| `GeneratedReferences.ts` | 95.86 (95.37) | 93.61 (92.96) | 86.36 (86.36) | 86.84 (84.37) | own tests | at or above |
| `HtmlCaseName.ts` | 97.54 (97.47) | 95.89 (95.83) | 93.61 (93.61) | 91.89 (91.66) | + case-name selection | at or above |
| `HtmlDiscovery.ts` | 100.0 (100) | 96.42 (96.38) | 83.33 (83.33) | 94.44 (94.11) | own tests | at or above |
| `HtmlGeometryPreparation.ts` | 97.05 (96.42) | 94.59 (93.54) | 100.0 (100) | 83.33 (77.77) | own tests | at or above |
| `InputDocument.ts` | 96.77 (96.72) | 95.58 (95.52) | 95.45 (95.45) | 88.88 (88.88) | own tests | at or above |
| `JournalMetadata.ts` | 100.0 (96.66) | 92.3 (91.66) | 50.0 (50) | 81.81 (81.81) | own tests | at or above |
| `LawMetadata.ts` | 100.0 (98.18) | 95.31 (95.08) | 50.0 (50) | 88.23 (88.23) | own tests | at or above |
| `MetadataComposition.ts` | 98.46 (99.22) | 97.88 (98.58) | 91.42 (92.68) | 100 (100) | 20 metadata files; clean HEAD same group: 98.38 / 97.79 / 91.42 / 100 | below (lines, statements, branches); no regression against clean HEAD |
| `MetadataStrings.ts` | 100 (100) | 100 (100) | 91.66 (91.66) | 100 (100) | + pin, post-case, law, journal | at or above |
| `PinExtraction.ts` | 100.0 (100) | 94.44 (94.11) | 90.0 (90) | 88.88 (87.5) | own tests | at or above |
| `PostCaseMetadata.ts` | 100.0 (98.03) | 98.24 (98.21) | 100.0 (100) | 90.0 (90) | own tests | at or above |
| `PreCaseMetadata.ts` | 100.0 (96.96) | 97.56 (97.43) | 100.0 (100) | 90.0 (88.88) | own tests | at or above |
| `ReferenceTokenExtraction.ts` | 97.33 (95.83) | 95.23 (93.82) | 86.36 (86.36) | 88 (84.61) | + loop, short missing page, four canonical replays | at or above |
| `RegexWorker.ts` | 97.56 (96.55) | 95.55 (93.93) | 80 (80) | 93.75 (90.9) | + generated references, context matcher, tokenizer, discovery, stop words | at or above |
| `SemanticExtraction.ts` | 97.05 (96.42) | 97.22 (96.66) | 83.33 (83.33) | 100.0 (100) | own tests | at or above |
| `SourceAnnotation.ts` | 98.33 (98.33) | 93.93 (93.93) | 92.0 (92) | 86.66 (86.66) | own tests | at or above |
| `SourceDocument.ts` | 96.55 (96.55) | 93.33 (93.33) | 100.0 (100) | 80.0 (80) | own tests | at or above |
| `SourceExtraction.ts` | 97.29 (94.59) | 97.29 (94.59) | 100 (100) | 88.88 (80) | + source document, paired source, report, engine layer | at or above |
| `StopWords.ts` | 98.14 (98.03) | 98.46 (98.38) | 100.0 (100) | 95.23 (94.73) | own tests | at or above |
| `TokenizedExtraction.ts` | 97.43 (97.29) | 95.65 (95.45) | 100.0 (100) | 86.66 (86.66) | own tests | at or above |
| `Tokenizer.ts` | 100.0 (98.75) | 98.87 (97.84) | 88.88 (88.88) | 100.0 (96.42) | own tests | at or above |
| `VerifiedExtraction.ts` | 97.91 (97.77) | 96.15 (95.91) | 93.33 (93.33) | 92.85 (92.3) | + source extraction, source document, paired source, engine layer | at or above |

MetadataComposition: the two uncovered lines (64, the substitution invalid-match
refusal; 178, the fallback native admission) are unchanged by this slice and
uncovered on clean HEAD by the same twenty files, so the floor depends on tests
outside any focused group; hosted CI measures the whole suite (decision "Judge
MetadataComposition coverage against the same focused group on clean HEAD").
SourceExtraction gained a behavior test (`CitationExtractionReport.test.ts`:
a malformed configuration is refused at installation with no child process).

| Check | Result |
| --- | --- |
| Each affected test file, one vitest run per file (142 files: every test that transitively imports a changed module or fixture; integration left to hosted CI) | 139 pass. `CitationSemanticExtraction.test.ts` failed, was fixed (install-failure deferral) and passes. `CitationExtractorControls.test.ts` (22) and `CitationSixFormProjection.test.ts` (1 of 2) fail identically on clean HEAD in this checkout (configuration schema refusal on the six-form extractor path, which A3 does not touch): inherited, left to hosted CI for attribution. |
| Files re-run after the deferral edit | Full-span replay 12/12; semantic extraction; the tokenized, document, entry, verified, source, loop and annotation-entry groups in the coverage runs (all passing). |
| `bun run beep quality package-verify @beep/law-practice-server --quick` | pass (lint, check). The full form runs the whole suite and is left to hosted CI. |
| `bun run docgen:local` | pass |
| `bunx biome check` on every changed file, including `goals/` | pass |
| `bun run beep lint policy-fingerprint --check` | current |
| `bun run beep skills update --check` | current (one pre-existing advisory on the yeet skill length) |
| `bun run beep knowledge semantic-delta` | 0 introduced, 0 resolved |
| Typecheck, source and tests (`tsrs`) | clean |

Process notes. One coverage batch mis-split a group line and ran the whole
law-practice suite once with coverage (28 failures under that load); it was
stopped and is not used as evidence. Under parallel instrumented runs,
`CitationCaseName.test.ts` and `CitationEngineLayer.test.ts` overran deadlines;
both pass in their individual runs.
