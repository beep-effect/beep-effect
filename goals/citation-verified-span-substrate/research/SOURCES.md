# Citation Verified Span Substrate — Sources & Provenance

This implementation ledger reproduces the source-exploration entries relevant
to verified spans, normalization-to-source mapping, straddle, ambiguity, and
source drift. The exploration ledger remains primary:
[`explorations/citation-grounding-hallucination-guard/research/SOURCES.md`](../../../explorations/citation-grounding-hallucination-guard/research/SOURCES.md).

- **Source exploration:** `explorations/citation-grounding-hallucination-guard`
- **Primary provenance ledger:** `explorations/citation-grounding-hallucination-guard/research/SOURCES.md`
- **Ratified contract:** exploration `DECISIONS.md`, `BRIEF.md`, and `MAP.md`

## 1. Relevant mined source corpus

| Nugget | Title | Upstream | Source (`file:line`) | License stance | Disposition here |
| --- | --- | --- | --- | --- | --- |
| `courtlistener#1` | Citation lookup parse plus exact character spans | courtlistener | `cl/citations/api_views.py:56-63` | AGPL-3.0-only | clean-room contract reference for exact half-open candidate spans |
| `doc-haus#2` | Verbatim quote verification with normalized-to-raw map and straddle | doc-haus | `dochaus/tool/verify-quote.ts:37-56` | mined contract license unknown | reference only; extend in-repo Apache-2.0 `lowerWithSourceOffsets`, do not copy |
| `doc-haus#4` | Output-side re-verification, nearest re-anchor, reject, and matter wall | doc-haus | `dochaus/plugin/legal.ts:214-232` | mined contract license unknown | reference only for fail-closed re-anchor; wall enforcement remains out of scope |
| `mike#3` | Verbatim quotation plus page-span output contract | mike | `backend/src/lib/chatTools.ts:120-136` | AGPL-3.0-only | clean-room contract reference for exact quote/page straddle |
| `research-squad#1` | Exact-text-preservation citation grounding | research-squad | `baml_src/agents/citations.baml:24-42` | repo MIT; file text unverified | pattern reference only unless file license is verified |
| `courtlistener#3` | Plain-to-markup offset mapping for citation annotation | courtlistener | `cl/citations/annotate_citations.py:77-128` | AGPL-3.0-only | reference only; annotation is a follow-on, prefer BSD eyecite `SpanUpdater` later |

**Implementation bearing:** extend the live repo's offset-map primitive; use
normalization only to locate; recover raw global offsets; require exact
`source.slice(start, end)` equality; retain source version; and reject absent,
ambiguous, stale, malformed-unit, or cross-matter evidence. No upstream code
with copyleft or unknown file licensing is copied.

## 2. Upstream repositories and licenses

| Repo | License | Port discipline | What informs this goal |
| --- | --- | --- | --- |
| courtlistener | AGPL-3.0-only | clean-room reference only | exact span/request shape; no source copying |
| mike | AGPL-3.0-only | clean-room reference only | verbatim quote plus page-span contract |
| doc-haus | package MIT; mined contract license unknown | reference only | normalized-to-raw map, straddle, and re-anchor/reject shape |
| research-squad | repo MIT; `.baml` file text unverified | pattern reference; verify before verbatim port | exact-text preservation discipline |
| eyecite | BSD-2-Clause | port with attribution when used | later port-safe `SpanUpdater`; not an implementation dependency for this substrate |

The source exploration corrects an earlier premise: `eyecite`,
`reporters-db`, `courts-db`, and `eyecite-js` are BSD-2-Clause; only the
CourtListener Django application is AGPL. This goal nevertheless adds no
`eyecite-js` dependency and implements no citation engine.

## 3. Relevant external research sources

These titles and URLs already appear on disk in the exploration ledger and raw
dossiers:

- [MDN `String.normalize`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize)
- [Hypothesis fuzzy anchoring](https://web.hypothes.is/blog/fuzzy-anchoring/)
- [`TextQuoteAndPosition`](https://github.com/judell/TextQuoteAndPosition)
- [Deterministic Quoting](https://mattyyeung.github.io/deterministic-quoting)
- [CLERC](https://arxiv.org/abs/2406.17186)
- [LegalCiteBench](https://arxiv.org/abs/2605.10186)
- [eyecite models](https://freelawproject.github.io/eyecite/models.html)
- [eyecite BSD-2-Clause license](https://raw.githubusercontent.com/freelawproject/eyecite/main/LICENSE)
- [eyecite `SpanUpdater`](https://raw.githubusercontent.com/freelawproject/eyecite/main/eyecite/annotate.py)

Full per-claim trails remain in the exploration's
`research/verbatim-span-verification-and-straddle.md`,
`research/ground-before-cite-contract-design.md`, and primary ledger.

## 4. In-repo capability references

| Capability | Path | Disposition |
| --- | --- | --- |
| `@beep/provenance` `TextAnchor` (`[startChar,endChar)` plus quote) | `packages/foundation/modeling/provenance/src/TextAnchor.ts` | reuse offset primitive; add schema-first verified constructor/decoder, source digest/version, and matter-scoped carrier |
| `@beep/langextract` `Alignment` and `lowerWithSourceOffsets` | `packages/foundation/capability/langextract/src/Alignment/index.ts` | extend deterministic mapping; strict path revalidates raw slice and accepts no fuzzy/lesser result |
| `GroundedExtraction` | `packages/foundation/capability/langextract/src/` | consume array directly as the first-slice input |
| Current langextract handoff | `packages/foundation/capability/langextract/src/Handoff/index.ts` | do not use as the span boundary; `toAnnotatedDocument` omits corresponding mentions |
| Law-practice `Span` clean/original mapping | `packages/law-practice/domain/src/values/Span/Span.model.ts` | reuse the ratified mapping pattern without importing legal vocabulary into foundation |
| File-processing extraction substrate | `packages/foundation/capability/file-processing/src/` | reuse as local source-text boundary; no privileged off-box lane |
| Epistemic `EvidenceSpan` and `ClaimGate` | `packages/epistemic/domain/src/values/EvidenceSpan/`, `packages/epistemic/use-cases/src/ClaimGate/` | downstream composition targets only; no epistemic lifecycle change in this goal |

## 5. Cross-links and provenance

- Source exploration:
  [`README`](../../../explorations/citation-grounding-hallucination-guard/README.md) ·
  [`BRIEF`](../../../explorations/citation-grounding-hallucination-guard/BRIEF.md) ·
  [`MAP`](../../../explorations/citation-grounding-hallucination-guard/MAP.md) ·
  [`DECISIONS`](../../../explorations/citation-grounding-hallucination-guard/DECISIONS.md) ·
  [`primary ledger`](../../../explorations/citation-grounding-hallucination-guard/research/SOURCES.md)
- Goal contract: [`SPEC.md`](../SPEC.md) and [`PLAN.md`](../PLAN.md).
- Program doctrine: [`docs/product/citation-grounding.md`](../../../docs/product/citation-grounding.md).
- Queued siblings remain in the exploration map:
  `citation-extraction-engine` and `citation-ground-before-cite`.
