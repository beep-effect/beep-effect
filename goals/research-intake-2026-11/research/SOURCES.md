# Research intake 2026-11 — Sources & Provenance

- **Source exploration:** `explorations/research-library-ontology`; primary
  ledger: [explorations/research-library-ontology/research/SOURCES.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/explorations/research-library-ontology/research/SOURCES.md).
- **Prerequisites:** `goals/research-library-ontology-core` (catalog models,
  ontology) and `goals/research-library-routes` (web, Box, VidBee, alphaXiv
  routes, hop gate), both `completed-retained` on `main`.

## 1. Mined source corpus

Out of repo by design: bytes, captures and findings live in the operator's
research library (`<research-root>/beep-effect`), never in this repository.

| Source | Title | Location | Theme | Disposition |
|--------|-------|----------|-------|-------------|
| `nov5-aggregation` | Research Aggregation November 5th 2026 (332 files) | `<research-root>/Research Aggregation November 5th 2026/` | nightlies, papers, link list, VidBee bundles | November intake hop 0 |
| `nov5-private-archive` | `Research-11-5-26/` private DM archive | inside the aggregation, inventoried as a private root | protocol and oracle-loop discussion | private partition, mined, never quoted |
| `box-nightlies` | 36 `beep-effect-nightly-*.md` (35 distinct) | Box root folder | Grok nightly reports | November intake hop 0 (authoritative series) |
| `box-spike-paper` | `arxiv-2610.01553v1-public-sample.pdf` | Box `beep-spikes` | paper | November intake hop 0 |
| `nov-hop1` | 2,116 cited identities | library captures and dispositions | web, papers, GitHub, YouTube, X | 1,140 readable, 975 reviewed dispositions |
| `nov-hop2` | 400 admitted of 75,918 catalogued | library captures | gated second hop | 303 readable |
| `box-ip-law-ontology` | `IP_LAW_ONTOLOGY_RESEARCH`, 449 PDFs | Box folder `386465627622` | legal ontologies, patent NLP | separate private intake, T1 only |

## 2. Upstream repositories & licenses

None vendored. Hosted routes used through repo drivers: Firecrawl
(`@beep/firecrawl`, existing plan credits), Box (`@beep/box`, CCG user
subject), `yt-dlp` captions, the paper route and GitHub cited objects.

## 3. External research sources

The three `/deep-research` runs cite their own public sources inline with
quotes; see `deep-research/G1-ontology-vs-rag.md`,
`deep-research/G2-legal-eval-validity.md` and
`deep-research/G3-skill-edit-regressions.md`, with claims in the matching
`*-claims.jsonl` files and harness receipts in `deep-research/receipts.jsonl`.

## 4. In-repo capability references

| Brick | Path | Use |
| --- | --- | --- |
| Research library commands | `packages/tooling/tool/cli/src/commands/Research/Library/` | inventory, acquire, import-result, hops, status, verify, mine |
| `mine` tier runners | `Library.mine.ts`, `Library.mine.runner.ts`, `Library.mine.text.ts` | T1/T2/T3 with output schemas, span checks, ModelRun argv, PDF text |
| Hop gate | `Library.hops.ts`, `Library.hopPolicy.ts` | routed parents, non-content filter, cross-site in-degree budget |
| PDF text | `packages/drivers/pdf-tools` | derived text for PDF captures and intake files |
| Runbook | `docs/runbooks/research-library.md` | private inputs, mining, status summary, hop gate |

## 5. Cross-links & provenance

- Coverage: [`COVERAGE.md`](./COVERAGE.md); routing: [`ROUTING.md`](./ROUTING.md)
  and [`routing.jsonl`](./routing.jsonl); contradictions and deep research:
  [`CONTRADICTIONS.md`](./CONTRADICTIONS.md); graduation portfolio:
  [`ADHD-PORTFOLIO.md`](./ADHD-PORTFOLIO.md); friction:
  [`OPPORTUNITIES.md`](./OPPORTUNITIES.md).
- Decisions: `../decisions/`.
