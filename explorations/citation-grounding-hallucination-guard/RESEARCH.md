# Citation Grounding & Hallucination Guard — Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale. Synthesized 2026-06-29
from research/*.md (raw, fully-cited subtopic dossiers).
-->

## External Landscape

Five subtopic dossiers carry the full citation trail; each paragraph below is a
synthesis with the load-bearing links inline, and a pointer to the raw file.

### Citation-parser landscape & licensing reality — [`research/legal-citation-parser-landscape.md`](research/legal-citation-parser-landscape.md)

The reference engine is **eyecite** (Free Law Project), which recognizes six
citation forms — full case, short case, statutory/law, law journal, supra, and
id — over a three-step pipeline (clean → tokenize via Aho-Corasick/Hyperscan
prefilter → extract metadata), reports ~99.9977% recall at ~10 MB/s, and emits a
`{volume, reporter, page}` `groups` dict plus three deliberate char-span methods
(`span()` matched-text-only, `span_with_pincite()`, `full_span()` whole-context)
([JOSS paper](https://www.theoj.org/joss-papers/joss.03617/10.21105.joss.03617.pdf);
[eyecite models API](https://freelawproject.github.io/eyecite/models.html)). The
**headline correction to CAPTURE**: eyecite is **BSD-2-Clause, not AGPL**
([LICENSE](https://raw.githubusercontent.com/freelawproject/eyecite/main/LICENSE)),
as are the data packages `reporters-db` (~1,167 reporters / 2,102 variations) and
`courts-db` ([reporters-db](https://github.com/freelawproject/reporters-db),
[courts-db](https://github.com/freelawproject/courts-db)); only the CourtListener
`cl/` Django app is AGPL
([pyproject.toml](https://github.com/freelawproject/courtlistener/blob/main/pyproject.toml)).
A BSD TS port already exists — `eyecite-js` (alpha, claims v2.7.6 parity, zero
native deps via a `String.includes` prefilter)
([eyecite-js](https://github.com/beshkenadze/eyecite-js)) — and a permissive MIT
declarative alternative is **CiteURL** (YAML templates, 130+ US sources)
([CiteURL](https://github.com/raindrum/citeurl)). For a Bun/Effect reimplementation:
skip native Hyperscan (heavy, x86-bound), use a literal prefilter + per-extractor
`RegExp`, and impose an `Effect` timeout/RE2 because the regexes carry no
worst-case (ReDoS) guarantee on untrusted input.

### Resolution & authority lifecycle — [`research/citation-resolution-authority-lifecycle.md`](research/citation-resolution-authority-lifecycle.md)

Two **distinct status vocabularies** must not be conflated: CourtListener's
persisted `UnmatchedCitation` 5-state model `NO_CITATION→FOUND→RESOLVED +
FAILED_AMBIGUOUS/FAILED` (a background-job resolution lifecycle, with
`citation_string` + eyecite-context `court_id/year/reporter/volume/page`)
([cl/citations/models.py](https://raw.githubusercontent.com/freelawproject/courtlistener/main/cl/citations/models.py)),
versus the lookup-API per-citation **HTTP-valued** `status` (200 found / 300
ambiguous / 400 reporter-unknown / 404 not-in-DB / 429 too-many)
([cl/citations/api_views.py](https://raw.githubusercontent.com/freelawproject/courtlistener/main/cl/citations/api_views.py)).
eyecite splits **parse** (`get_citations`) from **resolve** (`resolve_citations →
Resolutions = dict[Resource, list[CitationBase]]`), where ambiguous/unresolvable
cites are simply *dropped* — eyecite has no FAILED/AMBIGUOUS persisted state; that
bookkeeping is exactly what CourtListener's side table adds
([eyecite resolve.py](https://raw.githubusercontent.com/freelawproject/eyecite/main/eyecite/resolve.py)).
Reporter/court normalization comes from BSD `reporters-db`/`courts-db` crosswalks.
The hosted Citation Lookup API was built explicitly "as a guardrail for those …
using AI to generate legal content" and only matches full case citations (not
statutes/journals/id/supra), normalizing against 50M+ analyzed citations
([Free Law blog](https://free.law/2024/04/16/citation-lookup-api/),
[v4 API docs](https://wiki.free.law/c/courtlistener/help/api/rest/v4/citation-lookup)).

### Ground-before-cite contract design — [`research/ground-before-cite-contract-design.md`](research/ground-before-cite-contract-design.md)

The load-bearing rule (turn-scoped grounding: cite only from opinion/passage text
"supplied in this turn," never memory/metadata/search/verification output) is
corroborated by the production-grade reference implementation, **Anthropic
Citations**, which only lets the model cite `document`/`search_result` blocks
supplied in-request and returns interleaved `text` blocks whose `cited_text` is
extracted by the API (not the model) with `char_location`/`page_location`/
`content_block_location` discriminants
([Anthropic Citations](https://platform.claude.com/docs/en/build-with-claude/citations)).
The cure for the "mock/unspanned sources" anti-pattern is the first-class
`search_result` block (RAG passages passed as citable evidence)
([search_result docs](https://platform.claude.com/docs/en/build-with-claude/search-results)).
The hardest discipline is **Deterministic Quoting** — "the only way to guarantee
an LLM has not transformed text: don't send it through the LLM"; the model emits a
reference ID and a deterministic post-step substitutes the true source slice
([Matt Yeung](https://mattyyeung.github.io/deterministic-quoting)). Quality is
scored by **ALCE**'s NLI-entailment citation precision/recall (EMNLP 2023, TRUE/
T5-11B judge)
([ALCE repo](https://github.com/princeton-nlp/ALCE),
[arXiv 2305.14627](https://arxiv.org/abs/2305.14627)), with the
decompose-into-claims-then-NLI shape echoed by RAGAS faithfulness and "Cite Before
You Speak" ([arXiv 2503.04830](https://arxiv.org/abs/2503.04830)). The disclaimer
is not cosmetic: **Mata v. Avianca** (S.D.N.Y., June 2023) fined counsel $5,000
under Rule 11 for ChatGPT-fabricated citations, with 15+ further sanctions since
([Mata v. Avianca](https://en.wikipedia.org/wiki/Mata_v._Avianca,_Inc.),
[ACC analysis](https://www.acc.com/resource-library/practical-lessons-attorney-ai-missteps-mata-v-avianca)).
The portable-pattern source `research-squad` rides Apache-2.0 BAML
([BAML](https://github.com/BoundaryML/baml)).

### Verbatim-span verification & straddle — [`research/verbatim-span-verification-and-straddle.md`](research/verbatim-span-verification-and-straddle.md)

Verbatim citation must collapse to **VERIFIED-with-location or NOT-FOUND, never a
near match** — `match_fuzzy` (and arguably case-folded `match_lesser`) are too
lenient for a quote attributed to a court; CLERC confirms "exact matches with grep
are expected to achieve near-perfect accuracy" while loose verbatim matching
surfaces "a model's hallucinative tendencies"
([CLERC, arXiv 2406.17186](https://arxiv.org/pdf/2406.17186)). Normalization needs
a per-character **normalized-index→source-offset map** because Unicode `normalize`
changes string length (ñ↔n+◌̃, ﬀ→ff), so naive index arithmetic breaks
([MDN normalize](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize)).
Cross-chunk straddle has no per-chunk solution: Anthropic's own guidance makes
`char_location` indices chunk-local, so a quote spanning two chunk-documents is two
citations — the fix is verifying against the original or reconstructed full text
with a `chunk→[globalStart,globalEnd)` map
([Anthropic Citations](https://platform.claude.com/docs/en/docs/build-with-claude/citations)).
Page straddle uses a `[[PAGE_BREAK]]` sentinel folded out during normalization,
reported as a `page_location` range. The plain↔markup round-trip is eyecite's
**`SpanUpdater`** (BSD-2-Clause, diff-built piecewise offset map + `bisect`,
`is_balanced_html` with `unbalanced_tags="skip"/"wrap"`)
([eyecite annotate.py](https://raw.githubusercontent.com/freelawproject/eyecite/main/eyecite/annotate.py));
for Lexical, walk the node tree (do **not** use the deprecated
`$findTextIntersectionFromCharacters`) and mutate nodes, never strings
([Lexical text API](https://lexical.dev/docs/api/modules/lexical_text)).

### Governance & ethical-wall controls — [`research/citation-grounding-governance-controls.md`](research/citation-grounding-governance-controls.md)

The output-side **re-verification ladder** (exact → re-anchor nearest → reject) is
the well-studied Hypothesis/W3C "robust anchoring" fallback chain — `TextPositionSelector`
(exact offsets) degrading to `TextQuoteSelector` (recoverable quote), orphaning
rather than mis-placing on total failure
([Hypothesis fuzzy anchoring](https://web.hypothes.is/blog/fuzzy-anchoring/),
[TextQuoteAndPosition](https://github.com/judell/TextQuoteAndPosition)). **Two
staleness axes**: byte-level live-file drift (re-checked at output) vs
authority-level "good law" (reversal/overrule), where citators themselves miss
~1/3 of negative treatments and agree only ~15% of the time
([Hellyer study](https://www.aallnet.org/wp-content/uploads/2018/12/LLJ_110n4_02_hellyer.pdf)).
**LegalCiteBench** is the quantitative justification for ground-before-cite: models
score 6.80/100 producing citations from memory but ~90 *verifying* a supplied one,
with a >94% "Misleading Answer Rate" on retrieval — never let the model author a
cite, only verify one ([arXiv 2605.10186](https://arxiv.org/html/2605.10186v1)).
**Matter-isolation/ethical walls** are enforced at retrieval+context+output layers,
fail-closed, with agent-memory contamination as the novel risk (Harvey)
([Harvey](https://www.harvey.ai/blog/long-horizon-agents-and-ethical-walls)) — a
hard duty under **ABA Formal Opinion 512** (Jul 29, 2024, Model Rule 1.6)
([ABA](https://www.americanbar.org/news/abanews/aba-news-archives/2024/07/aba-issues-first-ethics-guidance-ai-tools/),
[UNC analysis](https://library.law.unc.edu/2025/02/aba-formal-opinion-512-the-paradigm-for-generative-ai-in-legal-practice/)).
Documents are **untrusted data** (OWASP LLM01, #1 on the 2025/2026 Top 10) — the
verbatim-equality gate **prevents fabricated quote text and unspanned citations**, but does NOT by
itself prevent an injected document from steering answer composition, tool choice, retrieval, or
non-quoted prose; classifier/segregation prompt-injection defenses stay retrieval/context/tool-policy
requirements *outside* this gate (the governance dossier scopes them out of this packet)
([OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)). Lookup
metering maps onto token-bucket + idempotency-key dedupe ("parse-once /
charge-per-citation")
([rate limiter](https://www.hellointerview.com/learn/system-design/problem-breakdowns/distributed-rate-limiter),
[Adyen idempotency](https://docs.adyen.com/development-resources/api-idempotency)).

## In-Repo Capability Inventory

beep-effect already owns the entire **grounding substrate**; this packet is a
downstream consumer that COMPOSES the bricks below through their public surface
rather than rebuilding them. All paths verified via `rg`/`ls` on 2026-06-29.

### Span / offset primitives (compose, do not rebuild)

- **`@beep/langextract` Alignment** — `packages/foundation/capability/langextract/src/Alignment/index.ts`.
  The existing verbatim grounder: `alignCandidate` runs `findExact` (`indexOf`) →
  `findLesser` (case-folded via `lowerWithSourceOffsets`, the normalized-index→source-offset
  `starts[]`/`ends[]` map) → `findFuzzy` (Levenshtein word-window), emitting
  `match_exact | match_lesser | match_fuzzy | unaligned`. Package license **Apache-2.0**
  (`packages/foundation/capability/langextract/package.json`). This is the MIT/Apache-clean
  base to **extend** for verbatim verification + straddle — preferred over porting the
  unknown-license doc-haus `normalizeWithMap`.
- **`@beep/provenance` TextAnchor** — `packages/foundation/modeling/provenance/src/TextAnchor.ts`.
  Half-open `[startChar, endChar)` + verbatim `quote` (`TextAnchorFields` exported); the char-anchor
  *shape* is isomorphic to Anthropic's `char_location`. **CAUTION:** the "`text.slice(startChar, endChar)`
  reproduces `quote`" rule is **documented intent in prose, NOT a schema-enforced guarantee**
  (`TextAnchor.ts:4-9`) — the only validator is `isWellOrdered` (`startChar <= endChar`), and the
  source itself flags cross-field schema enforcement as a tracked follow-up (`TextAnchor.ts:70-91`).
  For a hallucination guard this cannot be treated as a proof. netNew: a **verified
  constructor/decoder** that takes the source text (or source digest) and fails unless the slice
  exactly matches `quote`, persisting a verification timestamp/source digest if live-file drift matters.
- **`@beep/epistemic-domain` EvidenceSpan** — `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts`.
  `TextAnchorFields` (spread from `@beep/provenance`) + `Confidence` **only** (`EvidenceSpan.model.ts:76-80`).
  This is the **char-anchor primitive**, NOT a 1:1 Anthropic-citation model: it lacks
  `document_index`/source identity, title, the `char_location | page_location | content_block_location`
  discriminant, page/content-block variants, and the matter/source-trust fields the governance section
  later requires. Adopt it as the offset primitive; wrap it in a net-new citation-location tagged union
  + document/provenance envelope (a `CitationEvidence`/`MatterScopedEvidenceSpan`) for the internal
  grounded-answer model.
- **`@beep/nlp` Contract.Span + TextChunk + AnnotatedDocument** — `packages/foundation/capability/nlp/src/Handoff/Contract.ts`.
  `Span = {start, end}` (`NonNegativeInt`, refined `start <= end`) is the canonical handoff span. The
  same module already models `TextChunk` (`id`, `kind`, `provenance`, `span`, `text`; `Contract.ts:252-263`)
  and `AnnotatedDocument` (a `chunks: S.Array(TextChunk)` carrier; `Contract.ts:367-378`) — **extend/adapt
  these for the `chunk → [globalStart, globalEnd)` map** before declaring a bespoke chunk-reconstruction
  model. Its `Provenance` (`Contract.ts:225-236`) carries `source`/`generatedBy`/`timestamp`/optional
  `confidence` but **no matter or wall boundary** field (see the matter-id carrier gap in Constraints).
- **`@beep/file-processing` extraction substrate** — `packages/foundation/capability/file-processing/src/`.
  The existing local, privilege-safe source-text ingestion boundary: strategies for `pdf-text-layer`,
  `plain-text`, markdown, and Office formats (`Strategy/index.ts`), with `TextSpan {startOffset, endOffset,
  text}` and extraction results (`Extraction/index.ts:81-87`). It does not solve legal citations, but
  route privileged document text extraction **through this brick** rather than authoring a fresh
  source-text abstraction.
- **`@beep/lexical-schema` serialized-state substrate** — `packages/foundation/modeling/lexical/src/Lexical.model.ts`.
  Models serialized editor state + serialized text nodes and ships `nodeToPlainText` /
  `editorStateToPlainText` plain-text projections (`Lexical.model.ts:2222-2277`). Serialized-state
  parsing and plain-text projection are **existing bricks**; only citation annotation / range mutation
  is net-new (see Genuine gaps).

### Lifecycle / gate machinery (reuse the pattern, keep vocab orthogonal)

- **`@beep/shared-domain` ClaimLifecycle + ClaimLifecycleTransition** —
  `packages/shared/domain/src/values/ClaimLifecycle/ClaimLifecycle.model.ts`.
  `LiteralKit(["candidate","shape_valid","consistency_checked","admitted"])` (product-agnostic,
  strictly-forward admission) + transition value object `{from,to,reason}`. The citation
  RESOLUTION lifecycle is **orthogonal** (FAILED_AMBIGUOUS/FAILED have no home in a forward
  pipeline) → reuse the *pattern*, author a net-new `CitationResolution` LiteralKit.
- **`@beep/epistemic-domain` ClaimGateResult + ClaimGateViolation** —
  `packages/epistemic/domain/src/values/ClaimGate/ClaimGateResult.model.ts`.
  `ClaimGateVerdict.toTaggedUnion("verdict")({ admitted: {}, rejected: { violations } })` —
  the exact tagged-union pattern to mirror for `CitationResolutionResult`
  (resolved/ambiguous/unresolved) without touching it.
- **`@beep/epistemic-domain` CandidateClaim** —
  `packages/epistemic/domain/src/entities/CandidateClaim/CandidateClaim.model.ts`.
  `BaseEntity.Class` carrying `lifecycle` + `snapshot` + `fixtureKey`. A RESOLVED-and-verified
  citation becomes *evidence* feeding ClaimGate → a CandidateClaim advances ClaimLifecycle
  (composition, not forking). Lifecycle goal home: `goals/epistemic-claim-lifecycle-gate`
  (completed-retained).

### Drivers & domain (compose at the boundary)

- **`@beep/courtlistener` driver** — deleted 2026-08-13 (was a VERSION-only
  MIT skeleton). Recreate when this packet's citation-lookup wrap is pulled;
  see [`goals/honest-repo-signal/research/FOLLOW-UPS.md`](../../goals/honest-repo-signal/research/FOLLOW-UPS.md).
  (Tree-snapshot routed the driver to `gov-legal-data-driver-codegen`; the
  citation-lookup slice stays here.)
- **`@beep/anthropic` driver** — `packages/drivers/anthropic/src/`. The LLM driver to wire the
  Citations / `search_result` wire format through for native in-turn grounding.
- **`@beep/agents-server` AssistantTurn kernel** — `packages/agents/server/src/AssistantTurn/`.
  Implementation prior art for the **separate non-citation structured pass**: `AnthropicTurnKernel.ts`
  streams Anthropic forced-tool JSON blocks, validates each slice, holds invalid blocks, and repairs
  them (`AnthropicTurnKernel.ts:52-70`, `:115-167`), with provider-specific codecs (`AnthropicTurnCodec.ts`).
  Reuse this forced-tool + validate/repair loop for the strict-JSON sidecar pass rather than rebuilding it.
- **`@beep/law-practice-domain` entities** — `packages/law-practice/domain/src/entities/`:
  `Claim`, `OfficeAction`, `PatentAsset`, `PriorArtReference`, `Rejection` all exist. IP/legal
  domain entities extend here (via `law-practice-office-action-spike`), keeping citation vocab
  out of the epistemic slice.
- **`@beep/schema` LiteralKit / NonNegativeInt** — the kit underpinning every model above; the
  net-new `CitationResolution` enum + span refinements build on it.

### Goal homes for the scoped-out concerns (compose, do not own)

- `goals/official-data-sync-foundation` (active, SPEC present) — **candidate** static-dataset ingest
  home, but its contract does **NOT yet cover legal data**: the manifest `sourceTargets` are only
  `iso4217`/`iana-media-types`/`iana-timezones`/`cldr-territories` (`ops/manifest.json:61-66`) and the
  SPEC's Required Source Policy names only those official feeds (`SPEC.md:38-46`). The tree-snapshot
  routes court/reporter vocab here as an *attach-only recommendation* that the goal contract has not
  absorbed. **Open routing decision (carry into align):** either amend `official-data-sync-foundation`
  with explicit `reporters-db`/`courts-db` + negative-treatment/citator `sourceTargets`, or stand up a
  separate `court-vocabulary-resolver` goal with an explicit dependency from this packet. Until that
  contract amendment lands, do NOT treat the reporter/court crosswalk or the `isGoodLaw` "good law" feed
  as an owned home.
- `goals/agent-governance-control-plane` (**pending**, SPEC present) — **policy inheritance only, NOT a
  product access-control implementation.** Its scope is repo-wide *agent* governance (law canon,
  adversarial agent catalog, phase gates, prompt assets, law-to-command/auditor mapping; `SPEC.md:101-115`)
  and all phases are pending (`ops/manifest.json`). It does **not** implement product authorization,
  matter-scoped retrieval, context-assembly enforcement, or output filtering — a feasibility hole for a
  confidentiality-critical guard. **netNew:** a concrete product/security goal with target packages, a
  matter model, retrieval filters, context-builder enforcement, an output validator, an audit trail, and
  fail-closed tests; this governance packet supplies inherited *policy* only.

### Genuine gaps (NOT FOUND anywhere in `packages/**/src`)

- **Legal citation parser (eyecite-style)** — NOT FOUND. `rg -li eyecite` over `packages/`
  returns nothing; the only `*Citation*` symbols are unrelated (`AiCitation` in the Box driver,
  `Elicitation*` in ACP, `ClaimGate*` in epistemic). No `{volume,reporter,page}` + char-span
  parser exists. (netNew #1)
- **CitationResolution / UnmatchedCitation lifecycle** — NOT FOUND. No `CitationResolution`,
  `UnmatchedCitation`, or 5-state resolution enum in `packages/`. (netNew #2)
- **CourtListener citation-lookup driver wrap** — NOT FOUND. No `postCitationLookup` / lookup
  handler in-repo; `@beep/courtlistener` is a `VERSION`-only skeleton. (The `courtlistener-sdk` /
  `postCitationLookup` referenced in CAPTURE is an *external* mined repo, not in this tree.)
- **Ground-before-cite / verbatim-citation guard contract** — NOT FOUND. No turn-scoped grounding
  contract, output-side re-verification ladder, or `EvaluateCitationQuality`-style judge. (netNew #3)
- **Cross-chunk / cross-page straddle verifier** — NOT FOUND (partial). `@beep/langextract`
  Alignment matches a **single source string only**; no chunk reconstruction, global-offset map,
  or `[[PAGE_BREAK]]` handling. (netNew #4)
- **Reporter/court crosswalk ingest** — NOT FOUND. No `reporters-db`/`courts-db` data or resolver
  in `packages/`; belongs in `official-data-sync-foundation` → `court-vocabulary-resolver`.
- **Plain↔markup / Lexical citation annotation round-trip** — NOT FOUND (partial substrate exists).
  No `SpanUpdater`-style offset round-trip or Lexical mark/decorator annotation for citations is
  net-new. BUT `@beep/lexical-schema` already models serialized editor state + serialized text nodes
  and ships `nodeToPlainText` / `editorStateToPlainText` projections (`Lexical.model.ts:2222-2277`):
  serialized-state parsing and plain-text projection are existing bricks; only annotation / range
  mutation is net-new.

## Constraints

### Licensing gravity (reimplement-from-spec, do not copy)

- **AGPL → reimplement-not-copy.** CourtListener's `cl/` Django app is AGPL-3.0
  ([pyproject.toml](https://github.com/freelawproject/courtlistener/blob/main/pyproject.toml)):
  `cl/citations/api_views.py` (lookup view), `cl/citations/models.py` (`UnmatchedCitation`
  5-state model), `cl/citations/utils.py` (reporter crosswalk glue), and
  `cl/citations/annotate_citations.py` are **spec references only** — rebuild the
  request/response/status lifecycle and annotation rules from behavior. `mike` (CAPTURE
  nuggets mike#1/#3) is AGPL → reimplement the ground-before-cite contract from spec.
- **CAPTURE CORRECTION — eyecite is BSD-2-Clause, NOT AGPL** (CAPTURE caution was partly wrong).
  `eyecite`, `reporters-db`, `courts-db`, and `eyecite-js` are all BSD-2-Clause and port-safe
  (verbatim port requires retaining copyright + license text); the choice to reimplement is an
  *engineering* preference (TS-native, Effect-first, no native deps), not a license obligation
  ([eyecite LICENSE](https://raw.githubusercontent.com/freelawproject/eyecite/main/LICENSE)).
  `SpanUpdater` (annotate.py) is therefore safe to port — prefer it over the AGPL CL wrapper.
- **MIT:** CiteURL (declarative YAML alternative). **Apache-2.0:** BAML framework,
  google/langextract, and the in-repo `@beep/langextract` — extend the in-repo one.
- **Unknown license:** doc-haus (`verify-quote.ts` `normalizeWithMap`, re-verification ladder) —
  **design reference only**; implement the normalized→raw map by extending Apache-2.0
  `lowerWithSourceOffsets`, never by copying doc-haus.
- **Unverified license:** the `research-squad` repo's own license governing its `.baml` prompt
  text (BAML the *framework* is Apache-2.0; the repo's files are not confirmed) — the
  byte-identical-preservation *pattern* is reusable regardless; check before porting verbatim.

### Deprecations & dated gotchas

- **Anthropic Citations XOR structured outputs → HTTP 400 (current).** Enabling `citations` on a
  `document`/`search_result` block AND setting `output_config.format` returns 400 ("citations
  require interleaving … incompatible with the strict JSON schema constraints"). You cannot get
  both native `cited_text` and a strict-JSON sidecar from one call — pick interleaved cited
  blocks as the grounded answer; reserve strict JSON for a separate non-citation pass. **In-repo prior
  art for that pass exists:** reuse `@beep/agents-server`'s forced-tool validate/repair loop
  (`AnthropicTurnKernel.ts`) rather than rebuilding it (see In-Repo inventory)
  ([Anthropic Citations](https://platform.claude.com/docs/en/build-with-claude/citations)).
- **Lexical `$findTextIntersectionFromCharacters` deprecated** — "has never worked correctly and
  will be removed"; do NOT depend on it. Walk the node tree manually for the offset→node map
  ([Lexical text API](https://lexical.dev/docs/api/modules/lexical_text)).
- **CourtListener full API membership-gated as of 2026-05-07** — the hosted lookup is
  access-gated ([Free Law](https://free.law/2026/05/07/api-included-in-memberships/)).
- **Professional-responsibility anchors (dated):** ABA Formal Opinion 512 (Jul 29, 2024, Model
  Rule 1.6 confidentiality); Mata v. Avianca (S.D.N.Y., June 2023, $5,000 Rule 11 sanction) —
  the mandatory disclaimer constant is the user-facing surface of this duty.

### Auth / secret / offline boundaries

- **Privilege/offline:** the CourtListener hosted lookup leaks document text off-box — **unacceptable
  for privileged legal text**. Run the parser **locally** (BSD data + clean-room TS) for the
  privilege-safe path; reserve the hosted API for non-privileged enrichment/verification only.
  Token auth header (`Authorization: Token <token>`) is a managed secret.
- **Matter-isolation fail-closed:** every EvidenceSpan/citation must carry a matter id; a verified
  span from Matter A can never be re-emitted into Matter B; untagged → refuse. **No current model
  carries this:** `EvidenceSpan` is `TextAnchorFields` + `confidence` only (`EvidenceSpan.model.ts:76-80`)
  and `@beep/nlp` `Provenance` has `source`/`generatedBy`/`timestamp`/optional `confidence` but no matter
  or wall boundary (`Contract.ts:225-236`). netNew: a `CitationEvidence`/`MatterScopedEvidenceSpan`
  wrapper (or provenance extension) carrying `matterId`, `sourceDocumentId`, authority/source class, and
  wall-policy metadata **before** this precondition is enforceable. The fence *enforcement* itself is a
  downstream product/security goal (see Goal homes — the generic `agent-governance-control-plane` does
  not implement it); this packet owns the matter-tag-on-span precondition + the carrier model.
- **Official-primary-source provenance:** groundable provenance must be an official primary record
  (typed precondition); secondary/AI-restated sources are evidence-of-existence only. The
  webfetch allowlist itself lives in the agents tool-policy / gov-legal drivers.
- **Untrusted documents (OWASP LLM01):** source documents are data, never instructions; wrap the
  parser in an `Effect` timeout/interrupt (or RE2) because eyecite-class regexes carry no ReDoS
  worst-case guarantee on malicious input.

### Rate / cost limits (factual API constraints — non-copyrightable, safe to encode)

- **60 valid citations/minute** and **250 citations/request** (cites past 250 are parsed but
  unmatched, per-citation `status: 429`); on the minute throttle the response carries a throttle
  timestamp field whose **spelling is unverified** — the v4 doc render returned `wait_util`, prose
  elsewhere says `wait_until` (open item below). **Decode both spellings behind a compatibility
  codec** and confirm against a real 429 before treating either as the contract; do not bake a single
  spelling into a decoder. Per-citation status is HTTP-valued (200/300/400/404/429);
  the persistence model is the 5-state `CitationResolution`. Meter via token-bucket +
  idempotency-key dedupe (parse-once)
  ([v4 docs](https://wiki.free.law/c/courtlistener/help/api/rest/v4/citation-lookup),
  [discussion #6895](https://github.com/freelawproject/courtlistener/discussions/6895)).
- **CHAR-CAP DISCREPANCY (verify before coding):** the v4 docs state **64,000 characters** (~50
  pages), but CAPTURE (us-legal-tools#6) records a **10,000-char** cap — likely a conservative
  client cap or stale/v3 value. Chunk to the smaller of (client cap, 64k).

### Locked decisions & routing cautions

- **Keep citation/IP-law vocabulary OUT of the epistemic/shared slice** (epistemic SPEC non-goal).
  This packet is a downstream consumer composing `@beep/epistemic-domain` + `@beep/langextract`
  + `@beep/provenance` via their public surface, alongside `law-practice-office-action-spike` /
  `ip-law-knowledge-graph`.
- **Reuse, do not fork the lifecycle.** Net-new `CitationResolution` (5-state) is orthogonal to
  the 4-state `ClaimLifecycle`; mirror the `ClaimGateResult` tagged-union *pattern*, do not
  bend the shared vocabulary to fit FAILED/AMBIGUOUS exits.
- **Scoping splits (routing NOT yet settled — see Goal homes):** matter-isolation/ethical-wall fence →
  a concrete product/security goal (the generic `agent-governance-control-plane` supplies inherited
  policy only, not the access-control implementation); reporter/court vocab + citator "good law" →
  `official-data-sync-foundation` *only after* its `sourceTargets`/Required Source Policy are amended to
  cover legal data, else a new `court-vocabulary-resolver` goal. The guard consumes an external
  `isGoodLaw` flag (do NOT compute it here) and keeps staleness to "does this verbatim text still exist
  at this provenance."
- **`@beep/langextract` V1 DEFERS streaming (locked decision)** — any streaming/Partial-Complete
  citation grounding is a conflicting net-new, not a langextract extension.
- **Codegen:** if the CourtListener driver gets generated, reuse the repo's own Effect codegen
  path (`runpod` `openapi.json` + `scripts/generate.ts` precedent) — do NOT introduce
  Orval/axios/Zod; ODP-only for USPTO, NEVER PatentsView (sunset).
- **Reject-near-match is a guard policy, not a universal API guarantee** — Anthropic guarantees
  `cited_text` is verbatim/valid-pointer but does not forbid fuzzy; the "never near match" rule
  is a deliberate beep stance (doc-haus + CLERC grep-exact bar).

### Open verification items (carry into align/shape)

- `wait_until` vs `wait_util` field spelling; per-citation `status` wire type (int vs string);
  eyecite version pin (resolver signature set grows across releases, e.g. `MAX_OPINION_PAGE_COUNT
  = 150`); eyecite-js alpha maturity (self-reported parity, not independently validated);
  whether straddle reconstructs full text vs retains original (both need a `chunk→global` map);
  exact `reporters.json` edition-level schema; Lexical mark vs decorator node choice (shape stage).

---

_Codex gate-1 folded 2026-06-29: 5 blocking + 6 advisory addressed._

## 2026-07-14 correction — citation models landed after this research

The 2026-06-29 inventory’s “no parser models” / citation-model gap claims are
superseded. PRs #326 and #391 landed a schema-first citation taxonomy under
`packages/law-practice/domain/src/values/` after this packet’s research snapshot.
The live inventory contains roughly 56 value-object modules, including:

- the shared and union layers at
  `CitationBase/CitationBase.model.ts` and `Citation/Citation.models.ts`, plus
  `CitationSignal/`, `CitationType/`, `FullCitationType/`, and
  `ShortFormCitationType/`;
- per-form models such as `DocketCitation/DocketCitation.model.ts`,
  `NeutralCitation/NeutralCitation.model.ts`,
  `ConstitutionalCitation/`, `FederalRuleCitation/`, `JournalCitation/`,
  `TreatiseCitation/`, `TreatyCitation/`, `PublicLawCitation/`,
  `SessionLawCitation/`, `StatutesAtLargeCitation/`, `LocalOrdinanceCitation/`,
  `RestatementCitation/`, `CanonCitation/`, `LegislativeMaterialCitation/`,
  `FederalRegisterCitation/`, `StateRuleCitation/`, and `AnnotationCitation/`,
  `StatuteCitation/StatuteCitation.model.ts`, and
  `RegulationCitation/RegulationCitation.model.ts`;
- extraction/resolution values including
  `CitationWarning/CitationWarning.models.ts`,
  `ResolutionResult/ResolutionResult.model.ts`,
  `PinciteInfo/PinciteInfo.model.ts`, `ParallelGroup/ParallelGroup.model.ts`,
  `StringCitationGroup/StringCitationGroup.model.ts`,
  `CourtInference/CourtInference.model.ts`, and
  `DurableLocator/DurableLocator.model.ts`, plus `SurroundingContext/`; and
- normalized-to-original offset structures at `Span/Span.model.ts`,
  `ComponentSpan/ComponentSpan.models.ts`, `Segment/Segment.model.ts`, and
  `SegmentMap/SegmentMap.model.ts`, alongside patent-specific values such as
  `PatentNumber/`, `ApplicationNumber/`, `KindCode/`, `OfficeCode/`, and
  `PatentMetadata/`.

Fields such as `matchedText`, `confidence`, and `patternsChecked`, together
with full/short/Id./supra case forms and clean/original offsets, make this the
model layer of an eyecite-style port. **The remaining gap is the extraction
ENGINE** (tokenization, matching, extraction, grouping, and resolution over
those values), plus the generic verified-span mechanics—not a new citation
taxonomy and not an eyecite-js dependency.
