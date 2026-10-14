# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-06-29 — Gold-intake seed

Pointer: synthesized in `explorations/_gold-intake/GOLD_SYNTHESIS.md` →
section **`### Legal NLP & extraction`** (L894), specifically the subsections
**`#### Deterministic regex contract/structure extraction with char offsets`**
(L898) and **`#### Anti-inference "LLM as pure OCR" extraction discipline`**
(L924). Routing record:
`explorations/_gold-intake/routing.json` → cluster
`"Anti-inference structured extraction + deterministic doc-structure"`.

> SCOPE NOTE: this packet captures ONLY the cluster's **netNew** nuggets — the
> Partial/Complete streaming gate + the deterministic regex doc-structure
> extractors. The **alreadyCovered** anti-inference pure-OCR prompt-mode nuggets
> (TalentScore#1, LegalEase#1, legalmind-ai#1, Legal-AI_Project#2, stenoai#1)
> are ALREADY a separate langextract Case-A research note on
> `goals/langextract-capability`; they are listed below for reuse context only,
> NOT re-captured.

### Cluster rationale

The repo already owns the span-grounded LLM extraction substrate —
`@beep/langextract` has Extraction/Alignment/Service/Target and an active P4
goal — so the anti-inference "pure-OCR" prompt-mode nuggets are a pure-extend
Case-A research note on `goals/langextract-capability`, not new packets. But
that same goal's SPEC (L88-89) LOCKS streaming as deferred ("raw AI stream
chunks are not public API"), so the TalentScore Partial/Complete streaming gate
directly conflicts the lock and cannot attach there; and the deterministic,
no-model-in-the-loop regex contract/entity/caption/header extractors (doc-haus,
Juris.AI, LegalEase, doctor, mike) are a `@beep/nlp`-adjacent deterministic-logic
capability with no current home (`@beep/nlp`'s PatternParsers are wink-NLP
tooling, not a versioned char-offset contract-structure extractor). Both net-new
themes graduate into this sibling exploration.

route: `mixed` · primaryTarget: `goals/langextract-capability` (exists) · wave:
`P2` (histogram P1=3, P2=9, P3=3) · themeSpan: `effect-ts`,
`kg-ontology-reasoning`, `legal-nlp`, `provenance-evidence` · secondaryTargets:
`explorations/court-vocabulary-resolver`, `explorations/rag-retrieval-projection`,
`goals/file-processing-capability`, `goals/langextract-capability`,
`goals/trustgraph-port`, `packages/agents`, `packages/drivers/nlp-mcp`,
`packages/epistemic/domain`, `packages/foundation/capability/langextract`,
`packages/foundation/capability/nlp`, `packages/foundation/modeling/provenance`,
`packages/law-practice/domain`.

Notable secondary-target coordination notes from routing:
- `@beep/nlp` (`packages/foundation/capability/nlp`) — deterministic regex/pattern
  infra to coordinate with (Core/PatternParsers) so this sibling's deterministic
  extractor reuses pattern infra instead of duplicating.
- `@beep/provenance` (`packages/foundation/modeling/provenance`) —
  TextAnchor/EvidenceSpan target for char-offset rows from deterministic
  extractors and resolved LLM spans.
- `@beep/epistemic-domain` (`packages/epistemic/domain`) — Claim/Evidence
  candidate→approved lifecycle the streaming gate and deterministic candidate
  seeders feed.
- `goals/file-processing-capability` — PDF header-stamp / pdfplumber-style
  extraction (doctor#5) coordinates with file-processing + tika driver.

### Nuggets (10)

- **TalentScore#3** (TalentScore) — Partial(candidate) vs Complete(authoritative) streaming gate via tagged ParseEvent. `packages/domain/src/api/resume/resume-rpc.ts:153-193`. → feeds netNew "Partial/Complete streaming gate as an Effect Stream of a tagged ParseEvent union" (CONFLICTS langextract V1 streaming-lock → needs this sibling home; candidate→approved boundary into `@beep/epistemic-domain`). Snippet: `ParseEvent = Schema.Union(TaggedStruct("Partial",{data}), TaggedStruct("Complete",{analysis}))`; RPC `stream:true`; only the Complete payload is persisted.
- **TalentScore#4** (TalentScore) — Schema-first partial-vs-final models (Schema.optionalWith for streaming). `packages/domain/src/api/resume/resume-rpc.ts:109-140`. → feeds netNew "parallel partial-vs-final schema-first models" (strict authoritative record + progressively-filling PartialData). Snippet: strict `ResumeData extends Schema.Class` (all fields required) + `PartialResumeData = Schema.Struct({ name: Schema.optionalWith(Schema.NullOr(Schema.String),{exact:true}), ... })`; branded `ResumeId = UUID.brand`.
- **TalentScore#6** (TalentScore) — BAML→domain mapper layer with separate partial-stream mappers. `packages/server/src/public/resume/resume-rpc-live.ts:209-264`. → feeds netNew "extraction-library→domain adapter skeleton with parallel mapPartial* mappers" (Stream.async over async generator; getFinalResponse() triggers score+persist+single Complete emit). Snippet: `Stream.async((emit) => { for await (const partial of bamlStream) emit.single({_tag:"Partial", data: mapPartialResume(partial)}); const final = await bamlStream.getFinalResponse(); ... emit.single({_tag:"Complete", analysis}); emit.end() })`.
- **doc-haus#3** (doc-haus) — Deterministic regex contract-structure extraction (defined terms, cross-refs, parties, amendments) with char offsets. `services/ingest/src/structure.ts:13-49`. → feeds netNew "deterministic regex contract-structure extractor" (verbatim text + char offsets, NO model, versioned re-extraction migration; emits GroundedExtraction spans → epistemic.CandidateClaim → `@beep/law-practice` clause/party models). Snippet: `export const VERSION = "2"`; `TERM = [“"]([A-Z][^”"\n]{0,60}?)[”"]`; `REF_RE = /\b(Section|Article|Clause|Exhibit|Schedule|Annex|Appendix)s?\s+(\d+(?:\.\d+)*...|[A-Z]|[IVXLC]+)/g` — a miss is an absent row, never a wrong fact.
- **Juris.AI#3** (Juris.AI) — Regex-based legal-entity extraction catalog (statute/case/court/legal-term). `src/app/legal-bert/model.ts:82-100`. → feeds netNew "deterministic regex legal-entity catalog with hand-tuned per-type confidence + matchAll char-span indices as a cheap pre-LLM candidate seeder". Snippet: `patterns = [{type:'statute', regex:/\b([A-Z][a-z]+ Act( of \d{4})?)\b/g, confidence:0.85}, {type:'case', regex:/\b([A-Z][a-z]+ v\. [A-Z][a-z]+)\b/g, confidence:0.9}, ...]`; `text.matchAll` → `{type,text,confidence}[]` (trivially extends to capture match indices for `GroundedExtraction.span`).
- **LegalEase#4** (LegalEase) — Regex entity-and-relationship extraction into a node/link graph. `backend/services/entity_extraction.py:72-110`. → feeds netNew "deterministic regex entity-and-relationship extractor emitting a typed {nodes,links} contract graph (party/jurisdiction/date/obligation)" for a non-LLM first pass before OWL/SHACL proof (maps onto FalkorDB projection layer). Snippet: `obligation_patterns = [r'shall\s+([\w\s]+?)(?:\.|,|;)', r'must\s+...', r'agrees?\s+to\s+...']`; `links.append({source, target, label:"obligated to", strength:0.6})`.
- **doctor#4** (doctor) — Court caption-line alignment (Texas §, NY :, generic )). `doctor/lib/text_extraction.py:100-129`. → feeds netNew "court caption-line column alignment with documented per-jurisdiction separators as a legal-NLP normalization pass" (improves downstream parsing of styled opinion/office-action captions). Snippet: `for separator in [r")", "§", ":"]: pattern = rf"(.* +{re.escape(separator)} .*\n)"; matches = list(re.finditer(pattern, page_text))`.
- **doctor#5** (doctor) — PACER/court document-number extraction from PDF header stamp. `doctor/tasks.py:673-691`. → feeds netNew "PACER/court header-stamp isolation (pdfplumber font/position filter) + docket document-number regex extraction for filing→docket provenance linkage" (coordinates with `goals/file-processing-capability` + tika driver). Snippet: `get_header_stamp` (font `LiberationSans` OR `y0>750`) then `regex = r"Document:(.[0-9.\-.#]+)|Document(...)|Doc:(...)|DktEntry:(...)"`; `re.findall(regex, header_stamp)`.
- **harvest-mcp#3** (harvest-mcp) — Layered heuristic-then-LLM classification pipeline (cheap deterministic pass before fallible model). `src/agents/ParameterClassificationAgent.ts:417-466`. → feeds netNew "layered heuristic-then-LLM classification pipeline" (deterministic heuristics decide first with confidence; LLM only as fallback/refinement — the deterministic-wall-before-fallible-model discipline; minimizes LLM calls, keeps reasoning auditable). Snippet: `if (["q","query","search","text","texto","term"].includes(nameLower)) return {classification:"userInput", confidence:0.95, pattern:"search_query"}`; auth/token/key header → sessionConstant 0.8; pagination → userInput 0.9. NOTE: harvest-mcp license UNKNOWN → reimplement, do not vendor.
- **mike#5** (mike) — Tracked-changes apply with unique-anchor span matching. `backend/src/lib/docxTrackedChanges.ts:930-935`. → feeds netNew "unique-anchor tracked-changes span resolver" (find + context_before/after, whitespace/punctuation-tolerant, explicit ambiguous/not-found failure modes — resolves an LLM-proposed span back to an exact source char location; the core of turning fallible model output into a verifiable span). Snippet: ``Ambiguous match for find="..." Add longer context_before / context_after so the anchor is unique`` / ``Could not locate find="..." Re-read the document and copy context verbatim (including punctuation & whitespace)``. NOTE: mike is AGPL → reimplement clean-room, do not vendor.

### netNew — BUILD list (graduates into this sibling)

1. `Partial(candidate)` vs `Complete(authoritative)` streaming gate as an Effect Stream of a tagged ParseEvent union — only the terminal Complete crosses into authority (CONFLICTS langextract V1 streaming-lock; needs a sibling home).
2. Parallel partial-vs-final schema-first models (strict `Schema.Class` for the authoritative record + `Schema.optionalWith(NullOr)` PartialData for progressively-filling stream chunks).
3. Extraction-library→domain adapter skeleton with parallel `mapPartial*` mappers (`Stream.async` over an async generator, `getFinalResponse()` triggers score+persist+single Complete emit).
4. Deterministic regex contract-structure extractor: defined terms / Section-Article-Exhibit cross-refs / corporate-suffix parties+roles / amendment recitals, each row carrying verbatim text + char offsets, NO model in the loop, with a versioned re-extraction migration.
5. Deterministic regex legal-entity catalog (statute/case/court/legal-term) with hand-tuned per-type confidence and `matchAll` char-span indices as a cheap pre-LLM candidate seeder.
6. Deterministic regex entity-and-relationship extractor emitting a typed `{nodes,links}` contract graph (party/jurisdiction/date/obligation) for a non-LLM first pass.
7. Court caption-line column alignment with documented per-jurisdiction separators (§ TX, : NY, ) generic) as a legal-NLP normalization pass.
8. PACER/court header-stamp isolation (pdfplumber font/position filter) + docket document-number regex extraction for filing→docket provenance linkage.
9. Layered heuristic-then-LLM classification pipeline: deterministic heuristics decide first with confidence, LLM only as fallback/refinement (the deterministic-wall-before-fallible-model discipline).
10. Unique-anchor tracked-changes span resolver: find + context_before/after with whitespace/punctuation tolerance and explicit ambiguous/not-found failure modes — resolves an LLM-proposed span back to an exact source char location.

### alreadyCovered — REUSE context only (already a langextract Case-A note; do NOT re-capture)

- BAML "LLM as pure OCR" anti-inference prompt + typed extraction schema ("extract EXACTLY as written, DO NOT infer/reason/add") — pure-extend prompt-mode research note on `@beep/langextract`. (TalentScore#1)
- Risk-scored clause extraction prompt + strict "respond ONLY with valid JSON" contract for CandidateClaim generation — extend langextract Extraction prompt shaping (must add source char spans). (LegalEase#1)
- VerdictAnalysis fixed-record structured-extraction prompt schema + required-field validation loop — reference shape for langextract CandidateClaim extraction (express as effect/Schema + span provenance). (legalmind-ai#1)
- Span-grounded extractive QA with n-best ranking + null_score_diff_threshold null-handling — candidate-scoring reference for `@beep/langextract` span extraction / candidate→approved gate. (Legal-AI_Project#2)
- Overlapping map-reduce chunking sized to model context budget with clean-newline breaks — preprocessing that feeds spans into `@beep/langextract` before the candidate gate (langextract pipeline extend, not a new home). (stenoai#1)

### Cautions

- LOCKED-DECISION CONFLICT: langextract V1 SPEC (`goals/langextract-capability/SPEC.md` L88-89) defers streaming — the Partial/Complete gate (TalentScore#3/#4/#6) is marked `gapStatus=dup` in the catalog but is actually net-new-CONFLICTING; route to THIS sibling, do NOT reopen the langextract streaming lock. (Surfaced as a standards decision in DECISIONS.)
- Streaming, IF ever pulled into langextract, must be exposed as schema-backed LangExtract domain events, never raw AI chunks — keep this sibling's stream surface schema-first to stay reconcilable.
- PROVENANCE WALL: all adopted LLM-prompt nuggets emit free text / "exact clause text" but NO char offsets — beep's provenance wall requires source spans; no char-offset-less LLM prompts. The extend note must add `GroundedExtraction.span` before adoption.
- Source nuggets are Python (doctor, stenoai, Legal-AI_Project, LegalEase) and BAML (TalentScore) — port to Effect/TS + effect/Schema; do not vendor Python or BAML runtimes.
- LICENSING: `mike` is AGPL and `harvest-mcp` license is UNKNOWN → reimplement clean-room, do not vendor either.
- `legalmind-ai#1` is Taiwan jurisdiction (not US IP) — adjacent reference shape only, do not adopt its field set verbatim for office-action/patent extraction.
- Deterministic extractors must preserve the "a miss is an absent row, never a wrong fact" guarantee and the versioned re-extraction migration (doc-haus `VERSION` const) when ported.

## 2026-10-14 — correction (knowledge doctor verdict)

The `@beep/law-practice` name above is a package family, not a package. The domain
models it refers to live in `@beep/law-practice-domain` (`packages/law-practice/`).
The entry above is kept as captured.
