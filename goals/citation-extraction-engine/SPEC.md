# Citation Extraction Engine Spec

## Current authority and objective

The operator approved the six-form replacement on 2026-11-08. The [scope
decision](decisions/2026-11-08-six-form-completion-contract.md) supersedes the
exhaustive completion contract, oracle hierarchy, donor-wide accounting, phase
gates and stop-without-weakening rule in the prior packet. The prior packet is
preserved in git at
[7dc8c2d443d](https://github.com/beep-effect/beep-effect/tree/7dc8c2d443d3d8e43cd90a9fd8c5889417c6388f/goals/citation-extraction-engine).
Older generated decisions below are historical where they conflict with this
ruling. They do not reintroduce exhaustive parity through a later reading.

Deliver deterministic extraction and document-local linking for full case, short
case, Id., supra, 35 U.S.C. and 37 C.F.R. in supplied plain text. These six
forms are the completion boundary. Neither a full-case-only demo nor
verification of caller-supplied candidates alone satisfies discovery.

Repository law and architecture apply. The current user ruling outranks packet
history. SPEC defines behavior, PLAN defines execution, and GOAL is only the
compact launcher. Keep the goal active until delivery is proven.

## Required behavior

- Return semantic citation data and verified source occurrences separately. Use
  the existing domain schemas where suitable; no second public citation
  hierarchy, donor class, confidence score or Python host handle crosses the
  boundary. 35 U.S.C. and 37 C.F.R. remain FullLawCitation forms.
- Define canonical locator, pin and antecedent ranges before scoring candidates.
  Ranges are half-open original-source UTF-16. Every verified quote equals the
  selected source slice and respects surrogate boundaries. Donor token text is
  not automatically the quote; retain the distinction between token and
  pin-inclusive ranges. Normalize C.F.R. part/section fields without losing the
  full section, such as 1.56.
- Resolve references only within the supplied document. Preserve Resolved,
  Ambiguous and Unresolved outcomes. Define supported antecedent rules before
  the selection run. No forced first-match, fuzzy party match, heuristic score
  or fallback pointer becomes a verified resolution. Orphans remain unresolved.
- Report the supported profile, limitations, engine/vocabulary versions and
  diagnostics separately from semantics. An empty result does not certify that a
  document has no citations outside the profile.
- Preserve semantic citations, verified mentions, document-local mention and
  authority IDs, persisted entity IDs and diagnostics as distinct concepts.
  LawPractice.CitationId remains reserved for persisted entities.

## Boundaries, prerequisites and safety

The service contract remains in @beep/law-practice-use-cases/server; semantic
values remain in law-practice domain, and the live Layer remains in
@beep/law-practice-server/layer. Methods have R = never. Capture server services
in the Layer, with schema-owned input and closed tagged failures. Public/API
retirement requires a consumer/reachability check first.

Reuse the published verified-source/anchor and court/reporter vocabulary
contracts. The [prior compatibility
receipt](history/evidence/prerequisite-compatibility.md) records exact symbols
and approved adaptations; refresh its compatibility against the current public
exports during selection. An archived goal packet is not absence of its shipped
code contract. Do not import raw generated vocabulary, invent another offset
converter or decode a structural receipt as a runtime proof without canonical
source verification.

Preserve schema-owned resource ceilings, source privacy, concurrency limits,
clock-controlled timing, interruptibility and independent retirement evidence. A
safety failure returns a closed error without a successful-looking partial list.
No deadline or limit is increased to hide a failing test.

Use Effect-provided worker/process, transport, transaction/concurrency, Scope,
cancellation and collection capabilities where they fit. Confirm a concrete
missing capability, including configuration levers, before retaining a custom
facility. A same-thread timeout cannot preempt a synchronous catastrophic regex;
demonstrate a responsive supervisor and physical retirement outside that
matching thread. Vendoring identical patterns is not a safety mechanism.

## Exclusions and retained history

Completion excludes general Python object/hash/debug/subclass/mutation
compatibility, exhaustive upstream fixture closure, disposition of every donor
export/test, non-profile citation forms, HTML cleaning/reconstruction, XML/HTML
annotation, general diff reconstruction and arbitrary callable
cleaners/tokenizers. External authority lookup, fabrication judgments, claim
support, good-law status, paid services and editor/review workflows belong to
other work. Existing Bluebook/codec features are preserved; extending their
universal laws is not a new requirement of this delivery.

Do not delete working code or fixtures from their filenames alone. Check
consumers and reachable behavior before retirement. Existing regression and
provenance evidence remains useful; superseded ledger obligations must never be
relabelled complete. The old parity commands remain historical diagnostics, not
this release's completion gates.

## Implementation selection

Freeze one small, public, reviewable input file with expected outputs before
running candidates on it. Include every required form, negative/unsupported
examples, local-reference ambiguity and orphans, Unicode offsets and refusal
controls. Separate source-derived regression examples from independently
selected real-document excerpts. Label expected fields and range policy
independently of the candidate outputs; review disagreements against the source.

Compare the actual native Layer as it exists with pinned eyecite-ts and
eyecite-js through the same supplied-input contract. Official eyecite is a
diagnostic reference, not automatic gold. Existing isolated frozen installs were
explicitly authorized; no repeat authorization is needed. No production
dependency or Python runtime is selected by the scope decision.

Measure correctness on the frozen cases, abstention/misses, source fidelity,
local links, resource failures and timing under matched conditions. Do not infer
production throughput from old harness durations or rank implementations by
version labels, stars, lines or upstream suite counts. The nine-case
[operability screen](history/evidence/2026-11-08-six-form-smoke/README.md)
proves only that the cached contenders import and recognize basic forms.

Choose the least costly passing implementation from those observations. A pinned
dependency, vendored snapshot or bounded native path needs a recorded choice and
attribution. Forking/slicing changes the artifact and requires a rerun. Further
implementation repairs address demonstrated in-profile defects, not a reopened
parity program. If a runtime choice conflicts with a separate repo constraint
such as no Python, resolve that explicitly first.

## Acceptance and completion

1. The supported grammar, ranges/fields, local-link rules and limitations are
   explicit and the independently reviewed profile file is frozen.
2. The actual public Effect Layer passes that file and exact-source,
   ambiguity/orphan, refusal, responsiveness and retirement controls. No mock
   substitutes for the parser. Report sample limits without a broad accuracy
   claim. Any unresolved profile failure keeps delivery incomplete.
3. Refresh prerequisite compatibility and preserve legal attribution and
   structured schema/codec boundaries for the selected outputs.
4. Required scoped repository checks and owned hosted CI failures are resolved.
   Preserve meaningful assertions and timeout limits. Attribute unrelated main
   failures; publish ready work rather than queueing for local full proof.
5. Check consumer/API reachability before removing legacy code or moving
   compatibility-only tests out of release gates. Record the supersession.
6. Publish linked follow-ups under Yeet. Complete review, reflection, merge and
   retention checks; update the lifecycle only when main contains the bounded
   implementation and evidence. Mergeable or locally passing alone is not
   completed-retained.

Stop and record genuine incompatible prerequisite/runtime constraints,
unprovable source fidelity, unsafe unbounded execution, unauthorized cost or
missing authority. Do not silently weaken the six-form contract, guess links,
revive exhaustive parity or claim historical obligations passed.

## Decision log

Historical entries are retained below. The 2026-11-08 replacement ruling
controls conflicts with the prior completion contract.

Generated historical records below retain their original source formatting.

<!-- markdownlint-disable MD013 MD034 -->
<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug citation-extraction-engine`; add a `kind: decision` file there, never edit this block._

### Continue unchanged goal after PR 2511 merged, 2026-11-05

On 2026-11-05 the operator explicitly authorized continuing the unchanged citation-extraction-engine goal in a follow-up PR, starting with committed scanner and word-boundary work, after PR #2511 was squash-merged as 96a7698b63ed3e187981faf3b5b2d0663706ee91. This is a scoped exception to the one-PR delivery and reviewability stop condition. All parity, accounting, safety, proof, reflection, and lifecycle requirements remain binding; the prior PR merge does not prove goal completion. Preserve links to the prior PR and exact evidence, and publish ready changes using hosted CI.

Lane `citation-extraction-engine`

Reverse: Requires a new explicit operator instruction; this publication exception does not relax any acceptance requirement.

### Continue goal through linked follow-up PRs, 2026-11-05

On 2026-11-05 the operator explicitly authorized linked follow-up PRs for this unchanged goal when active PRs merge, starting with prepared HTML geometry and hosted quality repairs at 7fcf0897c0 after PR #2713 merged. This renews and generalizes the publication exception: preserve links to earlier PRs, exact source and proof receipts, all acceptance requirements, and the active full objective. A PR merge does not establish goal completion and this grants no merge authority, safety waiver or scope reduction.

Lane `citation-extraction-engine`

Reverse: Requires an explicit operator instruction changing this publication authorization; all goal acceptance gates remain binding.

### Record #2737's new-file coverage rows at measured values, 2026-11-07

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

Lane `fix/law-practice-coverage-ep36`

Reverse: Restore package floors by covering the listed worker programs with in-process tests

### research-intake-2026-11 routed 202 affirmative findings here, 2026-11-07

The research-intake-2026-11 intake routed 479 findings to this packet (202 affirmative, 11 critiques or disputes; 423 public, the rest from the private partition and not quoted). Routing table and method: goals/research-intake-2026-11/research/ROUTING.md; per-finding rows with spans live in the research library, filtered by packet in goals/research-intake-2026-11/research/routing.jsonl. Contested claims, if any, are clustered in goals/research-intake-2026-11/research/CONTRADICTIONS.md. Strongest public evidence:

- citesAsEvidence: https://github.com/beep-effect/beep-effect/blob/main/docs/ROADMAP.md — The source expressly denies model output independent citation authority and pairs this rule with source-span reproduction before a quote can cross the grounding boundary.
- usesMethodIn: https://arxiv.org/abs/2610.33489 — Error-aware LLM compilation loop: deterministic legality checks feed errors back to the LLM for repair, a reusable pattern for structured LLM extraction.
- supports: https://github.com/seandavi/ols-mcp-server — Motivation: LLMs hallucinate ontology terms and IRIs/identifiers. This argues for grounding agents against an authoritative ontology lookup service rather than relying on model recall.
- citesAsEvidence: https://www.thompsonhine.com/insights/ptab-applies-ex-parte-desjardins-to-reverse-section-101-rejection-of-neural-network-training-claims/ — Desjardins is precedential authority that ML training innovations can be computer-functionality improvements under § 101. It is a key citation edge for a legal/patent KG.
- citesAsEvidence: https://www.legal500.com/intelligence/united-states/corporate-commercial-law/california-adopts-law-to-impose-new-guardrails-on-attorneys-and-arbitrators-use-of-ai — SB 574 makes personal attorney verification of every filed citation a statutory duty (Civ. Proc. Code § 128.7(b)(2)(A)), which motivates citation-verification and hallucination-guard tooling.

This amendment adds evidence only; it changes no acceptance criterion. The owning lane decides whether any finding changes its plan.

Lane `feat/research-intake-2026-11`

Reverse: Delete this decision file and regenerate the block; the findings stay in the library and in research-intake-2026-11/research/routing.jsonl

### Keep two vitest workers for the law-practice-server integration suite, 2026-11-08

check.yml and heavy-admit.yml call heavy.yml@main, so the 90-minute Test Integration budget applies only after this PR merges; on the PR's own run (job 128583045297) the lane still stopped at 40 minutes with 15 of 47 law-practice-server integration files done (62 minutes of file time), even though the per-runtime split brought the bun canonical replay from 38 to 19 minutes. A local run of the whole suite with --maxWorkers=4 on a 64-core workstation still took 38 minutes and pushed CitationDiffWorker's 1005-source-map bun replay into its 600 s watchdog, so more vitest workers trade the lane timeout for load-dependent failures on the 8-vCPU heavy runner; the package keeps maxWorkers 2 and maxConcurrency 2. Until the budget lands on main, Test Integration on this PR is the same inherited red main carries (S11, attributed in the PR). The same local run exposed two failures that the lane timeout had been hiding and that do not depend on this PR: test/integration/CitationInputDocument.test.ts asserts reservedUnits === cleanerTextUtf16 when no geometry is produced and gets 0 for 5 on both runtimes (fixture unchanged since #2737; the reservation path changed in #2896), and the diff-worker corpus replay sits at the edge of its watchdog. Both stay with this packet. The deterministic test policy's operationDeadline moved from 30 s to 50 s (under the engine's 60 s ceiling, so the request-local-increase proof in CitationEngineLimits.test.ts still has room) so corpus replays that take 28 s locally stop failing on the slower hosted runner; the pinned engine artifact vector follows the policy.

Lane `@slop/11-6-26` · PR #2915

Reverse: Add --maxWorkers=N to the package's beep:test:integration script only with a hosted measurement showing the suite fits the lane without deadline or watchdog failures.

### Select the pinned TypeScript recognizer with existing proof and resolution, 2026-11-08

Adopt exact npm eyecite-ts 0.34.2 as the recognizer behind a product-neutral
driver and an owned Effect RPC child. Keep existing semantic Citation schemas,
verified source/mention constructors and strict document-local resolver; do not
use donor confidence or default linking. The frozen29-input/33-occurrence
comparison measured the native Layer before replacement: it misses three
bare-USC/CFR input rows, rejects empty input and mislinks ambiguous supra. The
TypeScript adapter matches all labeled fields/ranges/links, including the strict
resolver replay. The npm distributed artifact was downloaded without lifecycle
scripts, its registry SHA-512 integrity verified, and the same33 occurrences
matched again. Registry metadata declares MIT, no runtime dependencies and
Node>=22. Its gitHead is absent; do not claim a reproducible build or byte
identity with source commit34133d03143ea65861f48a5ed0eb32c931581666. Pin version
and integrity in the lockfile, retain upstream notice and record artifact
evidence. No Python runtime change. This decision permits dependency
integration, not acceptance: preserve the current engine until the actual
service passes profile, source/metadata, resource/privacy, physical-retirement
and runtime-packaging controls. Use supplied Effect RPC/serialization and
configured process levers; the existing owner retains cleanup
acknowledgement/quarantine.

Lane `feat/citation-six-form-contract` · PR #2966

Reverse: Remove the driver dependency and return the Layer composition to the preserved native engine; retain frozen labels and all comparative evidence.

### Replace exhaustive parity with six-form extraction and local linking, 2026-11-08

The operator explicitly selected "Use the proposed six-form extraction and
local-linking goal" on 2026-11-08 after independent Claude, Grok and Kimi
research and adversarial review. Muse was omitted at the operator's direction
after quota exhaustion. This ruling supersedes the exhaustive completion
objective and its stop-without-weakening instruction. It is a scope replacement,
not a claim that exhaustive parity was achieved.

Completion now means full/short case citations, Id., supra, 35 U.S.C. and 37
C.F.R. on supplied plain text; exact verified original UTF-16 anchors; and
document-local linking with explicit ambiguity and unresolved outcomes. Keep
schema-first semantic values, identity separation, closed failures, R = never,
prerequisite contracts, attribution, resource ceilings and Effect-provided
execution/resource primitives. HTML reconstruction, annotation, arbitrary
callbacks, Python object/hash/debug compatibility, donor-wide disposition
accounting, external lookup and claim-support/good-law work are outside
completion.

Preserve the current implementation and historical evidence. Compare its actual
public Layer with the pinned TypeScript candidates on a small frozen reviewed
input set, using official eyecite diagnostically. Do not require a pruning
rewrite before measurement. Published version labels, source line counts and
donor suite counts do not choose the winner. A production dependency or Python
runtime change still needs an explicit recorded decision supported by the
comparison; this ruling selects neither.

The source-controlled SPEC, PLAN, launcher and manifest are rebaselined
together. Older generated decision/checkpoint entries and the original ledger
remain historical, superseded where they conflict with this ruling, never
relabelled as passed. The pre-rebaseline packet is recoverable at commit
7dc8c2d443d3d8e43cd90a9fd8c5889417c6388f. Existing consumer/API reachability
must be checked before retiring code or tests. Required owned CI repairs,
focused real-Layer evidence, reflection and verified retention on main remain
completion duties. Publish ready linked follow-ups using hosted CI; unrelated
reds do not block publication.

Lane `feat/citation-six-form-contract`

Reverse: Restore the prior packet from 7dc8c2d443d only after a new explicit operator instruction; preserve the re-grounding evidence.

### Split the canonical replay per runtime and widen the Test Integration lane to 90 minutes, 2026-11-08

Since #2847 registered all 193 canonical inputs per runtime, Heavy / Test Integration on main hit its 40-minute lane timeout on every run (42417048100, 42422844786, 42426906781): the single integration file ran 44 shards behind the package's maxConcurrency 2 while the other worker drained the remaining 46 files, so the bun half alone took 38 minutes. The replay now lives in one file per runtime (bun in CitationCanonicalExtraction.test.ts, node in CitationCanonicalExtractionNode.test.ts) sharing one shard table, so both workers replay in parallel, and the lane budget is 90 minutes so the whole suite fits with headroom. The remaining lever is per-extraction cost (about 5 s per document plus 25 s of engine installation per shard) or sharding the integration lane like Test Unit; that stays with this packet.

Lane `@slop/11-6-26` · PR #2915

Reverse: Merge the node shards back into CitationCanonicalExtraction.test.ts and restore timeout_minutes: 40 in heavy.yml once the per-extraction cost or the lane sharding makes the suite fit.

### Test Integration needs about 100 minutes and fails on two tests the timeout hid, 2026-11-08

main's first run after #2915 (42444900312) ran Heavy / Test Integration for the full 90 minutes and still had 5 of 48 law-practice-server integration files left; the 43 finished files total 168.5 minutes of file time on the 8-vCPU heavy runner at two vitest workers, so the lane needs about 100 minutes. Two files fail deterministically regardless of budget: test/integration/CitationInputDocument.test.ts (reservedUnits 0, expected cleanerTextUtf16 5 on both runtimes) and test/integration/CitationDiffWorker.test.ts (the 1005-source-map bun replay hits its own 600 s watchdog at 599.8 s on hosted CI as well as locally). heavy.yml now gives the lane 120 minutes so it reports those failures instead of a cancellation; sharding or trimming the suite and fixing both tests stays with this packet.

Lane `ci/test-integration-budget-120`

Reverse: Lower heavy.yml timeout_minutes for Test Integration again once the law-practice-server integration suite is sharded or trimmed below the previous budget.

### Delete redundant law-practice-server citation tests and re-baseline coverage, 2026-11-09

Operator ruling (2026-11-09, verbatim): "deleting useless or unnecessary tests are warranted even if it breaks coverage whos ratchets can be re-adjusted."

Heavy / Test Integration ran 99 minutes as one turbo task over 50 law-practice-server citation files (11,382 s of file time at two vitest workers). A 31-agent census (five analysts, two adversarial refuters per group) found 45 of the 50 to be full-row twins of unit files that replay the same fixtures in smoke mode on both runtimes, and found `CitationCanonicalExtractionNode` replaying the same 22 shards as `CitationCanonicalExtraction` on node instead of bun.

Deleted integration files (29, about 5,037 file-seconds): G1 `CitationCanonicalExtractionNode`; G2 `CitationCaseNameSelection`, `CitationCaseName`, `CitationCaseNameProcess`, `CitationCaseNameScan`, `CitationHtmlCaseName`, `CitationStopWords`; G3 `CitationTokenizedExtraction`, `CitationDocumentExtraction`, `CitationExtractionEntry`, `CitationSemanticExtraction`; G4 `CitationCaseMetadata`, `CitationPreCaseMetadata`, `CitationPostCaseMetadata`, `CitationPinExtraction`, `CitationLawMetadata`, `CitationMetadataStrings`, `CitationHtmlDiscovery`, `CitationHtmlGeometryPreparation`; G5 `CitationAnnotationCallback`, `CitationAnnotationSkip`, `CitationAnnotationWrap`, `CitationXmlWorker`, `CitationContextMatcher`, `CitationTokenizer` (`integration/CitationExtractorSelection` is kept: review of this PR found it is the only replay of the 12 `controls.canonical.cases` selection and ordering vectors over the full 6,805-extractor configuration, which no unit test covers; it runs on bun only, spawns no runtime child, and takes about 3 s); G6 `CitationRegexCaptureReuse`, `CitationRegexLookahead`, `CitationRegexNullable`, `CitationRegexVerbose`. Deleted unit files (U1, about 207 s): `CitationCanonicalComplexMarkup`, `CitationCanonicalMissingPage` (rows 26, 27, 117, 122, 123, 129 stay in the bun integration canonical shards).

Trimmed, not deleted: G7 runs the eleven surviving full replays on bun only, keeping `integration/CitationEngineCorpus` on both runtimes as the one node full-corpus scene and `integration/CitationRegexTranslator` on both; G8 drops the fourteen odd `removeAmbiguous` twins from the EngineCorpus and VerifiedExtraction full filters (36 to 22 rows, eight families kept); U2 runs ExtractionLoop, CanonicalFullSpan, PageCorrection, PinSpan and ParsedEquality fully on bun with one node slice each (the ExtractionLoop node slice holds case 2); U3 trims the node smoke arm from 39 unit twins, keeping node scenes in `CitationDiffWorker`, `CitationXmlWorker` and `CitationHtmlGeometryPreparation` (one per worker kind with its own `*.node.entry.ts`), plus `CitationRegexWorker`, `CitationRecognizerWorker`, `CitationNativeProcess`, `CitationNativeSpawner` and `CitationSixFormProjection` untouched.

Kept as sole proofs (addendum 2.4): integration `CitationRegexTranslator`, `CitationInputDocument`, `CitationDiffWorker`, `CitationEditionInference`, `CitationCanonicalTokenizer`, `CitationCleanerNamedHtml`, `CitationCleanerNativeCustom`, `CitationHtmlUnicode`; all 45 unit twins; the 29 `*Coverage.test.ts` files. G9 (dedup canonical case rows) is killed: the proposed key merged 25 of 39 metadata-field shapes whose only end-to-end proof is the full canonical replay.

Smoke promotion (addendum 2.1 condition): each unit smoke set now holds at least one row per stop-word alternative, year-search family, law kind and regex profile subfamily (StopWords 14 to 28 rows, CaseMetadata 8 to 18, PostCaseMetadata 16 to 28, HtmlDiscovery 16 to 23, LawMetadata 10 to 14, PreCaseMetadata 230 to 233, HtmlCaseName 8 to 11, CaseNameSelection 8 to 9, PinExtraction 24 to 25, RegexVerbose rows 20 and 36).

Lane `claude/amazing-fermi-223c68`

Reverse: git revert the deletion PR, then restore the previous @beep/law-practice-server rows in standards/coverage.regression-baseline.jsonc from the parent commit (or rerun bun run coverage -- --filter=@beep/law-practice-server --write-baseline on the reverted tree).

### Hosted integration partitions run one Vitest worker and are sized on measured 4-vCPU walls, 2026-11-09

Measured on PR #3005 run 42600820554 (ubuntu-24.04, 4 vCPU, two Vitest workers, fifteen partitions sized from the 8-vCPU heavy timings): bodies ran 10.3 to 27.1 minutes. Single-file partitions took 1.12 to 1.49 times their 8-vCPU file seconds (1120 s -> 27.1 min, 844 s -> 15.8 min, 823 s -> 20.4 min); four-file partitions at two workers took 1.0 to 1.5 times their file-second sum (715 s -> 18.1 min, 708 s -> 11.8 min), so two workers on four cores gave almost no parallel gain, about one third of the heavy runner's throughput. Ten partitions failed: six on the 600 s per-test timeout of long single replays (SemanticExtraction, EngineCorpus, VerifiedExtraction, TokenizedExtraction, DocumentExtraction, ExtractionEntry, which the deletion lane removed or halved) and four on production operationDeadline / extractDeadline refusals from native replays (CanonicalExtraction ranges, Courts, ReferenceMarkup, CaseName, CaseNameScan) contending with a second worker; every single-file partition passed. The integration shards therefore pass --maxWorkers=1 to Vitest (CiLane.ts) so deadlines hold.

Sizing. With one worker (run 42606323648) every partition passed and hosted wall was 0.92 to 1.87 times the 8-vCPU two-worker file-second sum, so 8-vCPU timings do not size hosted partitions. After the deletion lane merged, a plan projected from halved two-runtime seconds (fourteen bins, run 42637925544) ran green but three jobs crossed ten minutes: the bun side of a bun-only replay runs 1.6 to 1.8 times the halved figure. The shipped plan is therefore LPT over the per-file hosted seconds measured on that run, at the smallest bin count whose largest bin stays under 450 s: sixteen partitions, planned bodies 318 to 425 s, measured jobs 5.9 to 9.0 minutes (run 42642253640). Same-runner-class spread between runs was 3 to 5 percent on unchanged files, so the plan is sized without a further safety factor. The canonical replay runs as six range files (4/4/4/4/4/2 shards).

Lane `claude/integration-hosted-partitions-ba7e3b` · PR #3005

Reverse: Drop --maxWorkers=1 from the integration shard passthrough in CiLane.ts once a hosted runner class with more cores is measured to keep the native deadlines at two workers.

### Keep the 8 effect-vitest exceptions PR 2994 adds as reviewed PR 2966 debt, 2026-11-09

PR 2994, the `unblocks-main` PR for episode ep70, adds 8 rows to `standards/effect-vitest.inventory.jsonc` for findings that PR 2966 introduced. S31 counts that as inventory growth. The rows stay as reviewed exceptions because none of them is a defect in the test code:

- 3 EV004 rows in `CitationNativeSocket.test.ts`: the `Effect.scoped` closes only the RPC client before the surrounding operation retires the child and the test asserts its retirement. The rule keeps deliberate shorter lifetimes for judgment.
- 4 EV010 rows in `CitationExtractorControls`, `CitationNativeSocket`, `CitationRecognizerWorker` and `CitationSixFormProjection`: these tests spawn real worker children, which cannot see a `MemoryFileSystem`.
- 1 EV010 row in `eyecite/test/index.test.ts`: it authenticates a committed artifact on the real filesystem, which a `MemoryFileSystem` would not hold.

Clearing them from the test code would mean either changing what the tests prove or moving the calls into support files that the scanner does not report, which only hides them. The operator chose to record them here instead.

Lane `@chore/deps-update-11-8-26` · PR #2994

Reverse: Delete the 8 rows from standards/effect-vitest.inventory.jsonc once EV004 and EV010 accept these tests or the tests are rewritten, then run bun run beep lint effect-vitest.

### Run the law-practice-server integration suite as hosted partitions that report Heavy / Test Integration, 2026-11-09

'Heavy / Test Integration' is reported by a hosted aggregate job that needs every integration partition and fails on failure, cancellation or skip; integration partitions run on GitHub-hosted runners on every non-docs PR.

Mechanism. The required context used to be the reusable heavy.yml job (called from check.yml's Heavy job, so GitHub named it Heavy / Test Integration). check.yml now runs Test Integration (lps-int-N) on ubuntu-24.04, one Vitest --shard of @beep/law-practice-server's integration suite each (sixteen shards, one Vitest worker), placed by the LPT plan in packages/law-practice/server/vitest.integration.shards.json over the per-file hosted seconds measured on PR #3005 run 42637925544, plus Test Integration (int-rest), the root integration lane with the sharded package filtered out for every other package. The aggregate job is literally named 'Heavy / Test Integration', the same way Coverage Regression took its context over, so standards/branch-protection-contexts.json and ruleset 10240248 are unchanged; while the resolved heavy.yml@main still declares its Test Integration job the aggregate takes the migration name 'Test Integration Partitions' (admission output legacy_integration), and after this change merges the heavy job is gone and the aggregate owns the context. The lane leaves Heavy Admission (heavyRouteLanes no longer lists test-integration), so the two-instance beep-ec2-heavy pool no longer queues it; the remaining heavy lanes keep admission. Pull requests keep --affected, so a PR that does not touch an integration owner runs the partition proof only.

Measured. The first plan projected partitions from 8-vCPU heavy timings; the hosted runs refuted that assumption (see the one-worker decision of the same date) and the shipped plan is sized on measured hosted seconds: sixteen partitions of 318 to 425 s of planned body ran 5.9 to 9.0 minutes of job on run 42642253640, the aggregate green 9.3 minutes after the first job started. The plan is regenerated whenever integration files change; test/vitest-integration-shards.test.ts fails until it matches the directory.

Lane `claude/integration-hosted-partitions-ba7e3b`

Reverse: Restore the test-integration job in heavy.yml and in the heavy route lanes, remove the check.yml partition matrix and aggregate, and drop the test-integration partitions from CiLanePartitions.ts and the sequencer plan from the package.

### Split integration replay files into row-range chunks, 2026-11-09

Integration replay files may be split into row-range chunks computed from the fixture row list; a guard test asserts the union equals the full set.

Shipped splits. The canonical corpus replay (test/integration/CitationCanonicalExtraction.test.ts, 1096.8 s of file time on the 8-vCPU heavy runner, about 71.5 hosted seconds per shard) is chunked into six contiguous ranges of its 22-shard table (4/4/4/4/4/2 shards), one file each (CitationCanonicalExtraction.test.ts and CitationCanonicalExtractionRange2..Range6.test.ts), every row still replaying with full=true. After the deletion lane (#3009, bun-only full replays) merged, CitationCanonicalParserOperations (8 groups of 10 rows) and CitationCanonicalRemainingExtraction (7 groups) received the same treatment through range helpers exported by their fixtures: two files each, 4/4 and 4/3 groups. test/CitationCanonicalExtractionRanges.test.ts asserts, for all three corpora, that the ranges are disjoint, that their concatenation is the whole table, and that exactly one integration file replays each range. No single-runner arrangement gets Heavy / Test Integration under ten minutes while one file alone takes 1097 s; the split is what lets hosted partitions be sized under the budget (the largest single integration file is now CitationRegexCaseFlags at 407 hosted seconds).

Lane `claude/integration-hosted-partitions-ba7e3b`

Reverse: Merge the range files back into one CitationCanonicalExtraction.test.ts and drop the range exports from the fixture; the guard test then asserts a single range.

### Two-runtime integration replays may be split into one file per runtime, 2026-11-09

An integration replay that runs the same corpus under both native runtimes may be split into one file per runtime over a shared fixture, so a hosted partition never carries both halves.

Shipped split. test/integration/CitationRegexTranslator.test.ts ran the native regex-translator qualification (full program-shard sweep plus the three-witness smoke) under bun and node in one file: 589 hosted seconds, more than a partition budget. Its body moved to test/CitationRegexTranslator.fixtures.ts as qualifyCitationRegexTranslator(kind, smoke); CitationRegexTranslator.test.ts replays bun (327 s measured) and CitationRegexTranslatorNode.test.ts replays node (290 s), each with the same 14-minute qualification timeout. The two files are independent partition inputs with identical assertions, so coverage of both runtimes is unchanged. The split applies to any two-runtime replay that exceeds the budget; a bun-only replay (the deletion lane's choice for the canonical corpora) does not need it.

Reverse: Merge the node twin back into the bun file's runtime loop and drop the shared fixture's kind parameter; regenerate vitest.integration.shards.json.

<!-- beep:decisions:end -->
<!-- markdownlint-enable MD013 MD034 -->
