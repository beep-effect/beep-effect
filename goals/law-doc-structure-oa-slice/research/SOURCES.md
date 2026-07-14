# Law Document Structure Office-Action Slice — Sources & Provenance

<!-- markdownlint-disable MD034 -- Provenance ledger preserves cited URLs verbatim. -->

- **Primary ledger:**
  [`explorations/deterministic-doc-structure-extraction/research/SOURCES.md`](../../../explorations/deterministic-doc-structure-extraction/research/SOURCES.md).
  The implementation-relevant corpus below is reproduced from that exploration;
  provenance corrections begin there and are synchronized here.
- **Source exploration:**
  [`explorations/deterministic-doc-structure-extraction`](../../../explorations/deterministic-doc-structure-extraction).
- **Freshness rule:** P0 verifies every fixture's public/non-client disposition,
  every regex-family provenance/license row, and every live repo capability path
  before freezing implementation.

## 1. Mined source corpus

| Source | Title | Upstream | Exploration location | Theme | Disposition |
| --- | --- | --- | --- | --- | --- |
| `doc-haus#3` | Versioned deterministic contract-structure regexes with character offsets and miss-as-absence | `doc-haus` | `services/ingest/src/structure.ts:13-49` | Rule versioning and exact spans | Design seed only; repo not publicly discoverable; clean-room reimplement |
| `Juris.AI#3` | Typed regex legal-entity catalog with per-type confidence priors | `Juris.AI` | `src/app/legal-bert/model.ts:82-100` | Typed match catalog | Port pattern with attribution under MIT; extend to exact `matchAll` spans |
| `LegalEase#4` | Regex entity-and-relationship extraction | `LegalEase` | `backend/services/entity_extraction.py:72-110` | Deterministic candidate construction | Study/port patterns with attribution under MIT; do not adopt untyped graph handoff |
| `harvest-mcp#3` | Deterministic-first then LLM-refinement cascade | `harvest-mcp` | `src/agents/ParameterClassificationAgent.ts:417-466` | Cascade policy | Unknown license; clean-room reference only; V1 takes no LLM path |
| `mike#5` | Unique-anchor resolution with explicit ambiguity/not-found outcomes | `mike` | `backend/src/lib/docxTrackedChanges.ts:930-935` | Fail-closed anchoring | AGPL-3.0-only; clean-room contract reference only; shared substrate owns implementation |
| `doctor#4/#5` | Court caption alignment and header-stamp extraction | `doctor` | `doctor/lib/text_extraction.py:100-129`; `doctor/tasks.py:673-691` | Layout/OCR lineage caution | BSD-2 reference; deferred to file-processing and not an OA V1 regex family |

### Implementation disposition

- The OA family itself is net-new and requires its own P0 provenance/license,
  local family/version, and parity-fixture row before any regex is adopted.
- Preserve the versioned re-extraction and miss-as-absence invariants; do not
  copy from undiscoverable, copyleft, or unknown-license material.
- Span uniqueness, normalization, drift, straddle, and exact raw-slice
  verification come from `citation-verified-span-substrate`, not a local fork.
- Streaming, court-PDF patterns, generic entity graphs, and LLM cascade code are
  excluded from this slice.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What this goal may take |
| --- | --- | --- | --- |
| `doc-haus` | MIT in catalog; public repo undiscoverable | design-reference/clean-room only | Versioned-rule and miss-as-absence invariants |
| `Juris.AI` | MIT | port-with-attribution | Typed regex-catalog pattern, adapted to raw spans |
| `LegalEase` | MIT | port-with-attribution | Deterministic regex pattern ideas only; not `{nodes,links}` evidence |
| `harvest-mcp` | UNKNOWN | clean-room/reference-only | Deterministic-first policy caution; no V1 LLM implementation |
| `mike` | AGPL-3.0-only | clean-room/reference-only | Ambiguous/not-found resolver contract only |
| `doctor` | BSD-2-Clause | port-with-attribution in owner packet | OCR/layout lineage lessons only; no court-PDF implementation here |

## 3. External research sources

### Deterministic extraction and exact offsets

- LexNLP defined-term extraction with coordinates (AGPLv3+commercial; clean-room
  reference only): https://github.com/LexPredict/lexpredict-lexnlp ·
  https://lexpredict-lexnlp.readthedocs.io/en/latest/about.html ·
  https://github.com/LexPredict/lexpredict-lexnlp/blob/master/lexnlp/extract/en/definitions.py
- OpenContracts source-on-every-field precedent (MIT):
  https://github.com/Open-Source-Legal/OpenContracts
- ECMAScript exact regex indices:
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/matchAll ·
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/hasIndices ·
  https://github.com/tc39/proposal-regexp-match-indices
- UTF-16 versus Unicode-code-point caution:
  https://docs.python.org/3/howto/unicode.html

### Span verification, abstention, and calibration

- Anthropic half-open character-location model:
  https://platform.claude.com/docs/en/build-with-claude/citations
- Anthropic unique-anchor ambiguous-failure contract:
  https://platform.claude.com/docs/en/agents-and-tools/tool-use/text-editor-tool
- Google LangExtract alignment ladder:
  https://github.com/google/langextract/blob/main/langextract/resolver.py ·
  https://deepwiki.com/google/langextract
- Selective prediction/abstention research:
  https://aclanthology.org/2402.15610v2 ·
  https://arxiv.org/html/2505.15008v2 ·
  https://www.medrxiv.org/content/10.64898/2026.01.21.26344531.full.pdf
- Calibration references:
  https://www.kdnuggets.com/a-deep-dive-into-calibration-of-language-models-platt-scaling-isotonic-regression-temperature-scaling ·
  https://arxiv.org/html/2411.02988v2

## 4. In-repo capability references

| Brick | Live reference | Disposition |
| --- | --- | --- |
| Verified raw anchor/source contract | `goals/citation-verified-span-substrate`; `packages/foundation/modeling/provenance` | BLOCKING REUSE after P0/P1 proof |
| Span-bearing extraction | `GroundedExtraction`; `packages/foundation/capability/langextract/src/Extraction/index.ts` | REUSE through explicit adapter |
| Clean/original legal spans | `packages/law-practice/domain/src/values/Span/Span.model.ts` | REUSE where compatible with substrate |
| Segment mapping | `packages/law-practice/domain/src/values/SegmentMap/SegmentMap.model.ts` | REUSE mapping pattern where compatible |
| Canonical confidence | `packages/foundation/modeling/schema/src/UnitInterval.ts` | REUSE branded boundary type via explicit adapters |
| Law-practice ownership | `packages/law-practice/{domain,use-cases,server}` | EXTEND for rules, candidates, workflow, persistence, and docketing seam |
| OA regex span family/version | No live repo implementation found in the exploration | NET-NEW; provenance/license/parity required per family |
| Patent docketing consumer | `goals/law-docketing-patent-spine` | CONSUMER of verified candidate pair, never automatic admission |

## 5. Cross-links & provenance

- Primary ledger and rationale:
  `explorations/deterministic-doc-structure-extraction/{RESEARCH,DECISIONS,BRIEF,MAP}.md`
  and `research/SOURCES.md`.
- Blocking substrate: `goals/citation-verified-span-substrate/`.
- First consumer: `goals/law-docketing-patent-spine/`.
- Citation override source:
  `explorations/deterministic-doc-structure-extraction/DECISIONS.md` Q4.
- Streaming and calibration remain queued under Q7/Q8 and their dated deferred
  entries; their upstream source rows stay in the primary ledger, not this V1
  implementation corpus.
