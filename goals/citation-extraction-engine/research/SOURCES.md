# Citation Extraction Engine — Sources & Provenance

This ledger carries the engine/parity entries from the source exploration. The
primary ledger remains
[`explorations/citation-grounding-hallucination-guard/research/SOURCES.md`](../../../explorations/citation-grounding-hallucination-guard/research/SOURCES.md).

- **Source exploration:** `explorations/citation-grounding-hallucination-guard`
- **Ratified contract:** exploration `DECISIONS.md`, `BRIEF.md`, and `MAP.md`

## 1. Relevant mined source corpus

| Nugget | Upstream | Source | Disposition here |
| --- | --- | --- | --- |
| `courtlistener#1` | courtlistener | `cl/citations/api_views.py:56-63` | AGPL clean-room contract reference for exact citation spans |
| `courtlistener#2` | courtlistener | `cl/citations/models.py:11-55` | AGPL facts/pattern reference; reuse existing durable values instead |
| `courtlistener#3` | courtlistener | `cl/citations/annotate_citations.py:77-128` | out-of-scope annotation reference; prefer BSD eyecite source later |
| `us-legal-tools#6` | us-legal-tools | `packages/courtlistener-sdk/src/mcp/handlers.ts:143-158` | MIT text-in/normalized-output pattern |
| `us-legal-tools#7` | us-legal-tools | `packages/courtlistener-sdk/src/mcp/http-schemas/citationResult.ts:8-12` | MIT typed normalized-citation result shape |

The exploration's grounding/guard nuggets remain relevant to downstream lanes,
but this goal consumes the verified-span substrate rather than rebuilding them.

## 2. Upstream repositories and licenses

| Repo | License | Port discipline | What this goal takes |
| --- | --- | --- | --- |
| [eyecite](https://github.com/freelawproject/eyecite) | BSD-2-Clause | port/reimplement with shared root attribution | pinned pipeline behavior, regexes, and attribution-safe parity fixtures after P0 inventory |
| [reporters-db](https://github.com/freelawproject/reporters-db) | BSD-2-Clause | consume through vocabulary goal, never raw | reporter identity and patterns via public compatibility API |
| [courts-db](https://github.com/freelawproject/courts-db) | BSD-2-Clause | consume through vocabulary goal, never raw | stable court identity via public compatibility API |
| [eyecite-js](https://github.com/beshkenadze/eyecite-js) | BSD-2-Clause | parity reference only | corpus expectations; no runtime dependency |
| courtlistener | AGPL-3.0-only | clean-room reference only | request/result facts; no source copying |
| us-legal-tools | MIT | port with attribution | typed result-shape reference |

The scaffold pins eyecite at
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`. P0 verifies that revision and
records checksums, fixture provenance/license, and affected material before any
derived implementation lands.

## 3. External sources

- [eyecite JOSS paper](https://theoj.org/joss-papers/joss.03617/10.21105.joss.03617.pdf)
- [eyecite models](https://freelawproject.github.io/eyecite/models.html)
- [eyecite BSD-2 license](https://raw.githubusercontent.com/freelawproject/eyecite/main/LICENSE)
- [eyecite resolution source](https://raw.githubusercontent.com/freelawproject/eyecite/main/eyecite/resolve.py)
- [eyecite SpanUpdater source](https://raw.githubusercontent.com/freelawproject/eyecite/main/eyecite/annotate.py)
- [re2js](https://github.com/le0pard/re2js)
- [OWASP prompt injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)

Full claim trails remain in the exploration's
`research/legal-citation-parser-landscape.md` and
`research/citation-resolution-authority-lifecycle.md`.

## 4. In-repo capabilities

| Capability | Path | Disposition |
| --- | --- | --- |
| Existing citation taxonomy | `packages/law-practice/domain/src/values/` | reuse/extend; engine is NET-NEW |
| `CitationBase` | `packages/law-practice/domain/src/values/CitationBase/` | reuse; repair confidence to branded UnitInterval |
| Full/short/Id./supra forms | per-form directories under law-practice values | emit directly |
| `Span`, `ResolutionResult`, `CitationWarning` | law-practice values | reuse; no replacement lifecycle |
| Canonical confidence | `packages/foundation/modeling/schema/src/UnitInterval.ts` | reuse at boundary with explicit decode |
| Verified span dependency | `goals/citation-verified-span-substrate` | consume public anchor contract |
| Vocabulary dependency | `goals/court-reporter-vocabulary` | consume stable IDs/version contract only |

## 5. Cross-links

- Source exploration: [`README`](../../../explorations/citation-grounding-hallucination-guard/README.md),
  [`BRIEF`](../../../explorations/citation-grounding-hallucination-guard/BRIEF.md),
  [`MAP`](../../../explorations/citation-grounding-hallucination-guard/MAP.md),
  [`DECISIONS`](../../../explorations/citation-grounding-hallucination-guard/DECISIONS.md), and
  [`primary ledger`](../../../explorations/citation-grounding-hallucination-guard/research/SOURCES.md).
- Confidence-owner decision:
  [`deterministic-doc-structure-extraction/DECISIONS.md`](../../../explorations/deterministic-doc-structure-extraction/DECISIONS.md).
- Blockers: [`citation-verified-span-substrate`](../../citation-verified-span-substrate/README.md)
  and [`court-reporter-vocabulary`](../../court-reporter-vocabulary/README.md).
