# Citation Grounding & Hallucination Guard — Sources & Provenance

Provenance ledger for this packet: it joins the mined gold nuggets in this
cluster to their upstream repos + licenses, the external research citations
that already live in this packet, and the in-repo `@beep/*` bricks the guard
composes. The implementing agent should be able to trace every decision back
to one of these four kinds of source.

- **Cluster:** Citation lookup + verbatim-span grounding (hallucination guard)
- **Route:** `new-exploration` (P1 wave; 11 nuggets — 7×P1, 3×P2, 1×P3)
- **Themes:** provenance-evidence · legal-nlp · governance-ops
- **Gold-intake provenance:** [`../../_gold-intake/ROUTING.md`](../../_gold-intake/ROUTING.md) · [`../../_gold-intake/routing.json`](../../_gold-intake/routing.json) · [`../../_gold-intake/GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md) (§ Provenance & evidence, line ~496; § legal-NLP citation-lookup, line ~950)
- **Codex research-gate review:** [`../reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md)

---

## 1. Mined source corpus (gold nuggets)

Every nugget in the source bundle, one row each. "Disposition" is the bundle
recommendation reconciled with the licence discipline in §2 (an AGPL upstream
can only be *clean-room reimplemented* regardless of the nugget's recommendation
verb).

| Nugget | Title | Upstream (repo) | Source (file:line) | Theme | Priority | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| `courtlistener#1` | Citation lookup API: eyecite parse + exact char spans | courtlistener (AGPL) | `cl/citations/api_views.py:56-63` | provenance-evidence | P1 | clean-room reimplement (rec: port; AGPL) |
| `doc-haus#2` | Verbatim quote verify w/ normalized→raw offset map + cross-chunk straddle | doc-haus (MIT pkg / contract unknown) | `dochaus/tool/verify-quote.ts:37-56` | provenance-evidence | P1 | reference only → extend `@beep/langextract` `lowerWithSourceOffsets` (rec: port) |
| `doc-haus#4` | Output-side citation re-verify ladder + matter-isolation wall + untrusted-doc framing | doc-haus (MIT pkg / contract unknown) | `dochaus/plugin/legal.ts:214-232` | governance-ops | P1 | reference only — clean-room the ladder/fence (rec: port) |
| `mike#1` | Ground-before-cite case-law research protocol (system prompt) | mike (AGPL) | `backend/src/lib/legalSourcesTools/courtlistenerTools.ts:81-90` | provenance-evidence | P1 | clean-room reimplement the contract from spec (rec: adopt; AGPL) |
| `mike#3` | Document-citation contract: verbatim quotes + page spans as JSON | mike (AGPL) | `backend/src/lib/chatTools.ts:120-136` | provenance-evidence | P1 | clean-room reimplement the output contract (rec: adopt; AGPL) |
| `research-squad#1` | Exact-text-preservation citation grounding prompt | research-squad (MIT repo / .baml text unverified) | `baml_src/agents/citations.baml:24-42` | provenance-evidence | P1 | adopt the byte-identical-preservation *pattern* (verify file licence before verbatim port) |
| `us-legal-tools#7` | Citation result schema (`normalized_citations`) for span grounding | us-legal-tools (MIT) | `packages/courtlistener-sdk/src/mcp/http-schemas/citationResult.ts:8-12` | provenance-evidence | P1 | port-with-attribution (MIT) |
| `courtlistener#2` | `UnmatchedCitation` status lifecycle (candidate→resolved/failed gate) | courtlistener (AGPL) | `cl/citations/models.py:11-55` | provenance-evidence | P2 | clean-room reimplement as net-new `CitationResolution` LiteralKit (rec: study; AGPL) |
| `courtlistener#3` | Span-grounded HTML annotation w/ plain↔markup offset mapping | courtlistener (AGPL) | `cl/citations/annotate_citations.py:77-128` | provenance-evidence | P2 | clean-room; prefer porting BSD `eyecite` `SpanUpdater` (annotate.py) instead — see §3 (rec: port; AGPL wrapper) |
| `us-legal-tools#6` | Citation lookup + normalization tool (text-blob in, normalized cites out) | us-legal-tools (MIT) | `packages/courtlistener-sdk/src/mcp/handlers.ts:143-158` | legal-nlp | P2 | wrap / port-with-attribution (MIT) |
| `Juris.AI#2` | Legal-advice prompt: retrieved context + mandatory disclaimer | Juris.AI (MIT) | `src/lib/ai-services.ts:566-668` | legal-nlp | P3 | study the disclaimer + source-footer pattern; re-ground on real spans (rec: study) |

### How these inform this packet

**Parse → exact char spans (the PROSE-IN primitive).** `courtlistener#1`
(`citation.span() → start_index/end_index`), `us-legal-tools#6/#7`
(`normalized_citations` result shape) define the contract the implementing agent
should clone: *text blob in → candidate citations carrying exact char offsets +
a normalized form out*. Take the **shape** (matched_text, corrected/normalized,
`[start,end)`); the courtlistener rows are AGPL so the request/response/status
behaviour is rebuilt from spec, while the us-legal-tools rows are MIT and may be
ported with attribution. Leave the Python/Django and Orval/axios plumbing
behind — DECISIONS Q1 locks a clean-room TS/Effect parser over BSD data
packages.

**Resolution lifecycle (orthogonal to the claim spine).** `courtlistener#2`'s
`NO_CITATION→FOUND→RESOLVED + FAILED_AMBIGUOUS/FAILED` is the load-bearing
contract: a parsed cite is a *fallible candidate* until authoritatively
resolved, and the failure exits have no home in a strictly-forward claim
pipeline. Take the **five-state pattern** as a net-new `CitationResolution`
LiteralKit; mirror `@beep/epistemic-domain` `ClaimGateResult`'s tagged-union
*pattern*; do **not** bend the shared 4-state `ClaimLifecycle` to fit (see §4
and the bundle `netNew #2`).

**Ground-before-cite (the hallucination guard itself).** `mike#1` carries the
hard rule — *final citations must be based on opinion text/passage snippets
supplied in this turn, never memory/metadata/search/verification output*;
`mike#3` makes it concrete output format (inline `[N]` markers + a `<CITATIONS>`
JSON block with `doc_id`/`page`/exact verbatim quote + `[[PAGE_BREAK]]` for
page-straddling quotes); `research-squad#1` is the byte-identical-preservation
enforcement (`<exact_text_with_citation>`, reject if non-citation text diverges
by even whitespace). Both `mike` rows are AGPL → reimplement the contract from
spec. The load-bearing snippet to carry as a contract:

> "Final case citations must be based on opinion text or passage snippets
> supplied in this turn. Do not cite cases based only on memory, metadata,
> search results, citationLinks, or verification results." — `mike#1`

This is bundle `netNew #3` (the verbatim-citation / ground-before-cite CONTRACT).

**Verbatim verification + straddle (the proof at the wall).** `doc-haus#2`
(`normalizeWithMap`: normalize whitespace/curly-quotes, keep a normalized→raw
offset map, reconstruct across chunk boundaries, return VERIFIED-with-location
or NOT-FOUND — *never* a near match) and `doc-haus#4` (output-side
exact→re-anchor-nearest→reject ladder against the LIVE file, matter-directory
fence, untrusted-document framing). doc-haus licence is unknown → these are
**design reference only**; implement the normalized→raw map by *extending*
Apache-2.0 `@beep/langextract` `lowerWithSourceOffsets`, never by copying
doc-haus. Cross-chunk straddle is bundle `netNew #4` (langextract Alignment
matches a single source string only).

**Annotation round-trip.** `courtlistener#3` (plain↔markup offset mapping via
`plain_to_markup`, `unbalanced_tags="skip"`, `full_span()` for Id/Supra) is the
round-trip needed to render citation annotations into rich (Lexical) source
without corrupting it. The CL wrapper is AGPL; RESEARCH points the implementer
at BSD-2-Clause `eyecite` `SpanUpdater` (annotate.py) as the port-safe source
for the same algorithm — prefer it.

**Disclaimer + source-footer (study, do not copy the anti-pattern).**
`Juris.AI#2` shows the prompt-template shape (numbered context block +
`Sources Referenced` footer + fixed disclaimer constant) but its "sources" are
*fabricated mock data with no spans* — exactly what beep must NOT do. Take the
disclaimer-constant + source-attribution-footer pattern; re-ground the template
on real provenance-spanned evidence before the LLM sees it.

---

## 2. Upstream repositories & licenses

One row per `reposUsed` entry. "Port discipline" follows the licence:
copyleft (AGPL) is **clean-room reimplement only** (pattern, not vendored code);
permissive (MIT) is **port-with-attribution**. doc-haus's package licence is
MIT but the legal-contract behaviour mined here is treated as **reference only**
(see callout).

| Repo | Tier | License | Port discipline | What we take |
| --- | --- | --- | --- | --- |
| courtlistener | T1 | AGPL-3.0-only | Clean-room reimplement (copyleft — pattern only, no source copy) | Citation-lookup request/response + char spans, `UnmatchedCitation` 5-state lifecycle, plain↔markup annotation rules (prefer BSD `eyecite` `SpanUpdater` for the latter) |
| mike | T1 | AGPL-3.0-only | Clean-room reimplement (copyleft — reimplement contract from spec) | Ground-before-cite turn-scoped grounding rule; verbatim-quote + page-span JSON output contract |
| doc-haus | T1 | MIT (pkg) — mined contract licence **unknown** | Reference only — extend Apache-2.0 `lowerWithSourceOffsets`, do not copy `normalizeWithMap` | normalized→raw offset map + straddle reconstruction; output-side re-verify ladder; matter-fence + untrusted-doc framing |
| research-squad | T1 | MIT (repo) — `.baml` prompt-text licence **unverified** | Pattern reuse safe regardless; verify the specific file before any verbatim port | Byte-identical exact-text-preservation citation-insertion discipline; LLM-judge `EvaluateCitationQuality` rubric shape |
| us-legal-tools | T1 | MIT | Port-with-attribution (permissive) | Typed `normalized_citations` result schema; citation-lookup text-blob-in handler; documented rate-limit constants |
| Juris.AI | T2 | MIT | Port-with-attribution (permissive) — but re-ground, do not copy the mock-source anti-pattern | Disclaimer-constant + source-attribution-footer prompt-template pattern |

> **Cautions (echoed from the bundle):** AGPL `courtlistener` + `mike` are
> clean-room-reimplement only — reimplement the citation-parse and
> ground-before-cite contracts from spec, do not copy source. `doc-haus`
> licence on the mined contract is unknown → treat the normalized→raw offset +
> straddle logic as reference only, and note that `@beep/langextract`
> Alignment already implements the normalized→raw mapping in Apache-2.0-clean
> repo code, so **extend it** rather than port doc-haus. **Reuse, do not
> rebuild** the existing `ClaimLifecycle`/`ClaimGate` pattern and
> `EvidenceSpan`/`TextAnchor` rather than introducing a parallel citation
> lifecycle. **Scope:** keep citation/IP-law vocabulary out of the epistemic
> slice (per the epistemic SPEC non-goals) — this packet is a downstream
> consumer composing epistemic + langextract via their public surface,
> alongside `law-practice-office-action-spike` / `ip-law-knowledge-graph`.
>
> **RESEARCH licence correction (load-bearing):** CAPTURE's "eyecite is AGPL"
> premise is wrong. `eyecite`, `reporters-db`, `courts-db`, and `eyecite-js`
> are all **BSD-2-Clause** and port-safe; only the CourtListener `cl/` Django
> app is AGPL. The choice to clean-room the parser is therefore an *engineering*
> preference (TS-native, Effect-first, no native deps), not a licence
> obligation — and `SpanUpdater` (eyecite `annotate.py`) is safe to port with
> attribution.

---

## 3. External research sources

Citations that already appear on disk in this packet (RESEARCH.md + `research/*.md`).
None are invented; titles map to the URLs present in those files.

**Citation parser & data (BSD / MIT):**
- eyecite — JOSS paper (`theoj.org/joss-papers/joss.03617/...`), models API (`freelawproject.github.io/eyecite/models.html`), LICENSE (BSD-2-Clause, `raw.githubusercontent.com/freelawproject/eyecite/main/LICENSE`), `annotate.py` `SpanUpdater` (`.../eyecite/main/eyecite/annotate.py`), `resolve.py` (`.../eyecite/main/eyecite/resolve.py`)
- `reporters-db` (`github.com/freelawproject/reporters-db`), `courts-db` (`github.com/freelawproject/courts-db`), `eyecite-js` (`github.com/beshkenadze/eyecite-js`), CiteURL (MIT, `github.com/raindrum/citeurl`)
- CourtListener `cl/` app — AGPL `pyproject.toml`, `api_views.py`, `models.py` (`raw.githubusercontent.com/freelawproject/courtlistener/main/...`); Citation Lookup API blog (`free.law/2024/04/16/citation-lookup-api/`), v4 docs (`wiki.free.law/c/courtlistener/help/api/rest/v4/citation-lookup`), membership-gating notice (`free.law/2026/05/07/api-included-in-memberships/`), discussion #6895

**Ground-before-cite & quality measurement:**
- Anthropic Citations (`platform.claude.com/docs/en/build-with-claude/citations`) and `search_result` blocks (`platform.claude.com/docs/en/build-with-claude/search-results`)
- Deterministic Quoting — Matt Yeung (`mattyyeung.github.io/deterministic-quoting`)
- ALCE (EMNLP 2023) — repo (`github.com/princeton-nlp/ALCE`), arXiv 2305.14627; "Cite Before You Speak" arXiv 2503.04830; CLERC arXiv 2406.17186; LegalCiteBench arXiv 2605.10186
- BAML framework — Apache-2.0 (`github.com/BoundaryML/baml`)

**Verbatim / offset / Lexical:**
- MDN `String.normalize` (`developer.mozilla.org/.../String/normalize`)
- Lexical text API (`lexical.dev/docs/api/modules/lexical_text`) — `$findTextIntersectionFromCharacters` deprecated
- Hypothesis fuzzy anchoring (`web.hypothes.is/blog/fuzzy-anchoring/`), `TextQuoteAndPosition` (`github.com/judell/TextQuoteAndPosition`)

**Governance / professional-responsibility (dated anchors):**
- Mata v. Avianca (`en.wikipedia.org/wiki/Mata_v._Avianca,_Inc.`), ACC analysis (`acc.com/resource-library/...mata-v-avianca`)
- ABA Formal Opinion 512 (`americanbar.org/news/.../aba-issues-first-ethics-guidance-ai-tools/`), UNC analysis (`library.law.unc.edu/2025/02/aba-formal-opinion-512-...`)
- Harvey — long-horizon agents & ethical walls (`harvey.ai/blog/long-horizon-agents-and-ethical-walls`)
- OWASP LLM01 prompt injection (`genai.owasp.org/llmrisk/llm01-prompt-injection/`)
- Hellyer citator study (`aallnet.org/wp-content/uploads/2018/12/LLJ_110n4_02_hellyer.pdf`)
- Distributed rate limiter (`hellointerview.com/learn/system-design/.../distributed-rate-limiter`), Adyen API idempotency (`docs.adyen.com/development-resources/api-idempotency`)

Full per-claim citation trails live in the five raw dossiers under
[`.`](.) (this `research/` dir): `legal-citation-parser-landscape.md`,
`citation-resolution-authority-lifecycle.md`,
`ground-before-cite-contract-design.md`,
`verbatim-span-verification-and-straddle.md`,
`citation-grounding-governance-controls.md`.

---

## 4. In-repo capability references

The `@beep/*` bricks this packet composes (from `secondaryTargets` +
RESEARCH § In-Repo Capability Inventory). All paths verified in RESEARCH on
2026-06-29.

| Capability | Path | Stance |
| --- | --- | --- |
| `@beep/langextract` Alignment (`findExact`/`findLesser`/`findFuzzy`, `lowerWithSourceOffsets` normalized→source map) | `packages/foundation/capability/langextract/src/Alignment/index.ts` | **Extend** (Apache-2.0 base for verbatim verify + straddle; preferred over doc-haus) |
| `@beep/provenance` TextAnchor (`[startChar,endChar)` + `quote`) | `packages/foundation/modeling/provenance/src/TextAnchor.ts` | **Reuse** offset primitive; **NET-NEW** verified constructor/decoder (slice-equals-quote is prose intent, not schema-enforced — only `isWellOrdered` exists) |
| `@beep/epistemic-domain` EvidenceSpan (`TextAnchorFields` + `Confidence`) | `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts` | **Reuse** as char-anchor primitive; **NET-NEW** citation-location tagged union + matter/document envelope (it is NOT a 1:1 Anthropic-citation model) |
| `@beep/nlp` Contract.Span + TextChunk + AnnotatedDocument + Provenance | `packages/foundation/capability/nlp/src/Handoff/Contract.ts` | **Extend** TextChunk/AnnotatedDocument for the `chunk→[globalStart,globalEnd)` map; Provenance carries no matter/wall field (gap) |
| `@beep/file-processing` extraction substrate (`pdf-text-layer`, `plain-text`, Office; `TextSpan`) | `packages/foundation/capability/file-processing/src/` | **Reuse** as the privilege-safe source-text ingestion boundary |
| `@beep/lexical-schema` serialized state + `nodeToPlainText`/`editorStateToPlainText` | `packages/foundation/modeling/lexical/src/Lexical.model.ts` | **Reuse** serialized-state parse + plain-text projection; **NET-NEW** citation annotation / range mutation |
| `@beep/shared-domain` ClaimLifecycle + transition VO | `packages/shared/domain/src/values/ClaimLifecycle/ClaimLifecycle.model.ts` | **Reuse the pattern**; **NET-NEW** orthogonal `CitationResolution` LiteralKit |
| `@beep/epistemic-domain` ClaimGateResult + ClaimGateViolation + CandidateClaim | `packages/epistemic/domain/src/values/ClaimGate/`, `.../entities/CandidateClaim/` | **Reuse the tagged-union pattern**; a RESOLVED+verified citation feeds ClaimGate as evidence (composition, not forking) |
| `@beep/courtlistener` driver (deleted 2026-08-13; was VERSION-only, MIT) | recreate via `goals/honest-repo-signal/research/FOLLOW-UPS.md` | **NET-NEW** citation-lookup wrap if this packet pulls the driver |
| `@beep/anthropic` driver | `packages/drivers/anthropic/src/` | **Extend** — wire Citations / `search_result` wire format for native in-turn grounding |
| `@beep/agents-server` AssistantTurn kernel (forced-tool validate/repair loop) | `packages/agents/server/src/AssistantTurn/` | **Reuse** as prior art for the strict-JSON sidecar pass (Anthropic citations XOR strict-JSON in one call) |
| `@beep/law-practice-domain` entities (Claim, OfficeAction, PatentAsset, …) | `packages/law-practice/domain/src/entities/` | **Extend here** (keeps citation/IP vocab out of the epistemic slice) |
| `@beep/schema` LiteralKit / NonNegativeInt | (kit underpinning all models above) | **Reuse** for the net-new enum + span refinements |

**Already-covered (do NOT rebuild — from bundle `alreadyCovered`):** exact
char-offset span grounding (`TextAnchor` + `EvidenceSpan`); candidate→admitted
lifecycle + SHACL `ClaimGate` verdict (`goals/epistemic-claim-lifecycle-gate`);
verbatim quote verification with normalized→raw mapping (`@beep/langextract`
Alignment).

**Genuine NET-NEW (from bundle `netNew`):** (1) eyecite-style legal citation
parser emitting exact char spans; (2) `CitationResolution`
candidate→resolved/failed lifecycle (distinct from claim-admission); (3) the
verbatim ground-before-cite guard CONTRACT; (4) cross-chunk straddle
verification.

---

## 5. Cross-links & provenance

- **Cluster id:** `citation-grounding-hallucination-guard` (gold-intake cluster
  "Citation lookup + verbatim-span grounding (hallucination guard)", 11 nuggets,
  route `new-exploration`). `crossref` in the bundle is empty (no graduated goal
  yet; sibling packets named in scope below).
- **Secondary targets / sibling homes:** `goals/epistemic-claim-lifecycle-gate`
  (completed-retained — claim lifecycle + ClaimGate spine), `goals/provenance-shared-claim-kernel`,
  `packages/foundation/capability/langextract`, `packages/epistemic/domain`.
  Scope-adjacent sibling packets: `law-practice-office-action-spike`,
  `ip-law-knowledge-graph`. Unsettled goal routing (carry into align): court/reporter
  vocab → amend `goals/official-data-sync-foundation` *or* a new
  `court-vocabulary-resolver`; matter-isolation fence → a concrete product/security
  goal (not the generic `goals/agent-governance-control-plane`).
- **This packet:** [`../CAPTURE.md`](../CAPTURE.md) · [`../RESEARCH.md`](../RESEARCH.md) · [`../DECISIONS.md`](../DECISIONS.md) · [`../BRIEF.md`](../BRIEF.md) · [`../MAP.md`](../MAP.md) · [`../ops/manifest.json`](../ops/manifest.json)
- **Raw research dossiers:** the five `research/*.md` files listed in §3.
- **Codex review:** [`../reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md) (5 blocking + 6 advisory, folded into RESEARCH 2026-06-29).
- **Gold-intake:** [`../../_gold-intake/ROUTING.md`](../../_gold-intake/ROUTING.md) · [`../../_gold-intake/routing.json`](../../_gold-intake/routing.json) · [`../../_gold-intake/GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md) (§ Provenance & evidence; § legal-NLP).
