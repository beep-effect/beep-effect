# Repo Reuse Audit

Scope: P1 read-only reuse lane for `@beep/langextract`.

Status: completed from export-catalog search, packet files, standards, and source inspection. The target package `packages/foundation/capability/langextract` did not exist during research.

## Facts

- The packet requires a hard reuse gate before public primitives are added: search the repo export catalog, inspect `@beep/nlp`, and classify overlaps as `reuse as-is`, `extend @beep/nlp first`, or `langextract-local with rationale`.
- `standards/repo-exports.catalog.md` and `standards/repo-exports.catalog.jsonc` had no existing `@beep/langextract` package export. Hits for `langextract` were limited to the goal packet.
- `@beep/nlp` already exists as a foundation capability with explicit subpath exports for `Core`, `Handoff`, `Tools`, `Backend`, and related modules.
- `@beep/nlp/Handoff/Contract.ts` already defines `Span`, `Provenance`, `TextChunk`, `Mention`, `Entity`, `Relation`, and `AnnotatedDocument`.
- `@beep/nlp/Core/Token.ts` already defines branded non-negative character offsets through `CharPosition`, plus token models with half-open `start` and `end` offsets.
- `@beep/nlp/Core/Document.ts` already defines a document model with `id`, `text`, `tokens`, `sentences`, and helpers such as token range lookup.
- `@beep/file-processing/Extraction` already has a `TextSpan`, but its offsets are explicitly byte or character offsets supplied by an engine. It is not a canonical source-grounded NLP character span.
- Provider-specific language model construction already lives in driver packages such as `@beep/openai-compat`, `@beep/xai`, and `@beep/venice-ai`.
- Existing drivers adapt provider clients into `effect/ai/LanguageModel` layers; `@beep/langextract` can consume that injected service without importing drivers.

## Evidence

- Packet reuse requirement: `goals/langextract-capability/GOAL.md`, `SPEC.md`, and `ops/manifest.json`.
- Existing NLP handoff primitives: `packages/foundation/capability/nlp/src/Handoff/Contract.ts`.
- Existing NLP core document/token primitives: `packages/foundation/capability/nlp/src/Core/Document.ts` and `packages/foundation/capability/nlp/src/Core/Token.ts`.
- Existing NLP package exports and dependency shape: `packages/foundation/capability/nlp/package.json`.
- Existing NLP consumer policy: `packages/foundation/capability/nlp/README.md`.
- Existing file-processing span: `packages/foundation/capability/file-processing/src/Extraction/index.ts`.
- Existing provider language model adapters: `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts`, `packages/drivers/xai/src/XAiLanguageModel.service.ts`, and `packages/drivers/venice-ai/src/VeniceAiLanguageModel.service.ts`.

## Classifications

| Candidate | Classification | Rationale |
| --- | --- | --- |
| `@beep/nlp/Handoff.Span` | extend `@beep/nlp` first | Correct conceptual home and half-open docs exist, but stricter non-negative and `start <= end` invariants should be promoted before using it as a public LangExtract output contract. |
| `@beep/nlp/Handoff.Provenance` | extend `@beep/nlp` first | Existing confidence is finite but not bounded to `[0, 1]`; LangExtract grounding should not duplicate this model. |
| `@beep/nlp/Handoff.TextChunk` | reuse as-is or extend narrowly | Already models text chunks with source spans. Add generic helpers in `@beep/nlp` only if LangExtract needs reusable chunk/span mapping. |
| `@beep/nlp/Handoff.Mention` | reuse as-is | This is the nearest public representation for source-grounded extraction mentions. |
| `@beep/nlp/Handoff.Entity` | reuse as-is | Fits typed/entity extraction output. LangExtract-specific metadata can be local then adapted. |
| `@beep/nlp/Handoff.Relation` | reuse as-is | Fits relation extraction with optional evidence spans. |
| `@beep/nlp/Handoff.AnnotatedDocument` | extend `@beep/nlp` first | Needs enough document/source identity to serve as a public LangExtract handoff. Avoid a parallel LangExtract annotated document IR. |
| `@beep/nlp/Core.Document` | reuse as-is | Already owns document text, token, sentence, and id concepts. |
| `@beep/nlp/Core.CharPosition` | reuse as-is | Existing branded character position should be the source for public offset semantics where practical. |
| `@beep/file-processing.TextSpan` | do not reuse as canonical | Its byte-or-character wording is engine-oriented and too broad for grounded character spans. It can remain useful for ingestion/file extraction metadata. |
| Prompt templates, examples, extraction targets | langextract-local with rationale | These are LangExtract-specific orchestration concepts, not general NLP primitives. |
| Parser states, alignment traces, model retry state | langextract-local with rationale | These are implementation details of the extraction capability. |
| Concrete provider model layers | reuse outside package | Compose from drivers at app/test boundaries; do not import them from foundation. |

## Inferences

- The public handoff shape should converge on `@beep/nlp`, not introduce another general annotation model in `@beep/langextract`.
- `@beep/langextract` should own the behavior that makes LangExtract distinctive: schema-guided prompt construction, model response parsing, deterministic source alignment, typed extraction results, and conversion into NLP handoff models.
- If a primitive would be useful to non-LangExtract NLP consumers, it should be promoted into `@beep/nlp` before `@beep/langextract` exports it.
- Internal structures that explain the alignment pipeline may remain local if they are not stable cross-package vocabulary.

## Recommendations

1. Promote stricter span and confidence invariants in `@beep/nlp/Handoff` before exposing LangExtract public output.
2. Keep `@beep/langextract` public output adapters aimed at `@beep/nlp/Handoff`.
3. Add a README reuse-audit section to `@beep/langextract` documenting each reused or promoted primitive.
4. Keep prompt/parse/align implementation types inside `@beep/langextract` unless a second consumer appears.
5. Use injected `LanguageModel.LanguageModel` and local deterministic fakes for tests.
6. Do not use `@beep/file-processing.TextSpan` as the source span contract; use it only when accepting upstream file extraction metadata.

## Do Not Do

- Do not duplicate `Span`, `Provenance`, `TextChunk`, `Mention`, `Entity`, `Relation`, or `AnnotatedDocument` as general public models in `@beep/langextract`.
- Do not import concrete provider drivers from `@beep/langextract`.
- Do not treat the v3 reference package as repo topology.
- Do not make ingestion/file-processing spans the canonical grounded source-span primitive.
- Do not add placeholder public exports just because the reference package had similarly named modules.

## Open Questions

- Should the first implementation update `@beep/nlp/Handoff.Span` directly, or add a new stricter `GroundedSpan` there and then migrate existing handoff models to it?
- Should `AnnotatedDocument` gain top-level mentions/source text, or should LangExtract return a separate result that contains a source document plus an NLP handoff annotation?
- What initial real consumers should be named for the foundation capability proof?
