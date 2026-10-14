# Claim Element Graph — Sources & Provenance

- **Cluster / origin:** a literature sweep on 2026-10-14, anchored on IPRally's invention-graph
  paper (arXiv 2610.01553). It used 57 agents (8 facets plus 2 critic-driven gap rounds) and a
  15-claim refutation pass. The full report is [SWEEP-2026-10-14.md](./SWEEP-2026-10-14.md) and
  the paper-by-paper dispositions are in [CATALOG.md](./CATALOG.md).
- **Provenance:** the 21 sources this packet depends on were acquired into the reusable research
  library at `$HOME/YeeBois/research/beep-effect`.
  - Intake input: `ops/discovery-inputs/claim-element-graph-2026-10-14/sources.md` in that
    library. It is a separate intake that follows the precedent of
    [research-corpus-synthesis](../../research-corpus-synthesis/README.md) phase 2.
  - Commands: `bun run beep research library inventory`, then `acquire --source <id>` ×21, then
    `verify`, then `render`.
  - Verify reported `missing=0`, `integrityFailures=0`, `requiredFailed=0`, and 1,010 readable
    sources (up from 989).
  - Originals, PDFs and repository clones stay in the library, not in this repo.

## 1. Mined source corpus

Nothing has been mined at `file:line` granularity yet. Section 2 lists the repos inspected after
acquisition. The IPRally data census is in the addendum at the top of
[SWEEP-2026-10-14.md](./SWEEP-2026-10-14.md) and in [RESEARCH.md](../RESEARCH.md) §External
Landscape.

## 2. Upstream repositories & licenses

All licenses were read from the acquired clones in the research library.

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [iprally/invention_graph_eval](https://github.com/iprally/invention_graph_eval) | MIT (© 2026 IPRally) | port-with-attribution | Invention-graph JSON shape for interop; 5k teacher-labelled eval graphs and a 5k typed-label training sample as a regression/interop target, not gold |
| [ShangDataLab/FLAN-Graph](https://github.com/ShangDataLab/FLAN-Graph) | MIT (© 2024 Shang Data Lab @UCSD) | port-with-attribution | Deterministic claim-element tree rules |
| [boschresearch/fine-patents](https://github.com/boschresearch/fine-patents) | MIT (© 2026 Robert Bosch GmbH) | port-with-attribution | Feature → passage → verdict record shape; adversarial claim-only control |
| [boschresearch/pedantic-patentsemtech](https://github.com/boschresearch/pedantic-patentsemtech) | README declares MIT code and CC-BY 4.0 data; **no LICENSE file in the clone** | reference-only until a LICENSE file exists (data citable under CC-BY with attribution) | §112(b) reason taxonomy; recitation re-anchoring |
| [LGAI-Research/PANORAMA](https://github.com/LGAI-Research/PANORAMA) | CC BY-NC 4.0 | reference-only; internal evaluation only, never shipped | Per-claim non-final-rejection (CTNF) parse schema; ODP join recipe |
| [ysy2003/ToC](https://github.com/ysy2003/ToC) | none | reference-only | Element disclosure labels; typed amendment operations |

## 3. External research sources

Acquired (library source-ID prefix · URL):

| Group | Source | Library ID |
| --- | --- | --- |
| Anchor | [arXiv 2610.01553](https://arxiv.org/abs/2610.01553) — From Rules to Neural Graphs (IPRally, ECML PKDD 2026) | `8cb976d59fab` |
| Anchor | [iprally/invention_graph_eval](https://github.com/iprally/invention_graph_eval) | `a3bde7cc11fa` |
| Lineage | [arXiv 2508.10496](https://arxiv.org/abs/2508.10496) — Efficient Patent Searching Using Graph Transformers (PatentSemTech'25) | `103617f2f6a6` |
| Structure | [arXiv 2404.14372](https://arxiv.org/abs/2404.14372) — FLAN-Graph | `5c9126707cf5` |
| Structure | [ShangDataLab/FLAN-Graph](https://github.com/ShangDataLab/FLAN-Graph) | `5ba98fb23ce8` |
| Structure | [arXiv 2605.10073](https://arxiv.org/abs/2605.10073) — PHAGE heterogeneous dependency graph | `b95061277e62` |
| Structure | [arXiv 2607.24040](https://arxiv.org/abs/2607.24040) — Pointer-augmented claim generation (SPG) | `bce67ebbaf03` |
| Structure | [arXiv 2604.18882](https://arxiv.org/abs/2604.18882) — Formally verified patent analysis (Lean 4) | `c71c6727355b` |
| US data | [arXiv 2604.04295](https://arxiv.org/abs/2604.04295) — ACE §112(b) cascade | `6f6e862c9f41` |
| US data | [arXiv 2505.21342](https://arxiv.org/abs/2505.21342) — PEDANTIC | `c177c4acdd98` |
| US data | [boschresearch/pedantic-patentsemtech](https://github.com/boschresearch/pedantic-patentsemtech) | `036b063778dd` |
| US data | [arXiv 2510.24774](https://arxiv.org/abs/2510.24774) — PANORAMA | `efcc86a518a2` |
| US data | [LGAI-Research/PANORAMA](https://github.com/LGAI-Research/PANORAMA) | `29430a423201` |
| US data | [arXiv 2605.02392](https://arxiv.org/abs/2605.02392) — FiNE-Patents (SIGIR'26) | `9ef0a84deae7` |
| US data | [boschresearch/fine-patents](https://github.com/boschresearch/fine-patents) | `d612a77cd01c` |
| US data | [arXiv 2609.36550](https://arxiv.org/abs/2609.36550) — Grounded Revision vs. Prior Injection | `3f0936042555` |
| US data | [arXiv 2511.16972](https://arxiv.org/abs/2511.16972) — ToC: Tree-of-Claims (AAAI 2026) | `beb0d1a2df8b` |
| US data | [ysy2003/ToC](https://github.com/ysy2003/ToC) | `eb77ca573685` |
| Metrics | [arXiv 2607.28532](https://arxiv.org/abs/2607.28532) — MarkushGlyph / OCSRGlyph | `5654d892dab8` |
| Metrics | [arXiv 2605.25186](https://arxiv.org/abs/2605.25186) — By Their Fruits You Will Know Them | `9f50e614c9e5` |
| Metrics | [arXiv 2608.12326](https://arxiv.org/abs/2608.12326) — Semantic Preservation in Legal Ontology Learning | `a4ccfce2f0ad` |

Not acquired: the other 117 verified papers from the sweep. Every one has a URL, tier and
disposition in [CATALOG.md](./CATALOG.md). Papers routed to other packets are their owners'
evidence to acquire.

## 4. In-repo capability references

| Brick | Path | Disposition |
| --- | --- | --- |
| `@beep/law-practice-domain` `PatentClaim`, `PatentClaimTransition`, `inspectPatentClaimDependencies`, `PatentClaimDependencyIssue` | `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts` | extend: sibling element projection; reuse the diagnostic pattern |
| `@beep/law-practice-use-cases` `PatentClaimCandidate` | `packages/law-practice/use-cases/src/PatentClaimCandidate/PatentClaimCandidate.ts` | extend to element granularity |
| `@beep/provenance` `TextAnchor` | `packages/foundation/modeling/provenance/src/TextAnchor.ts` | reuse for element spans |
| `@beep/epistemic-domain` `CandidateClaim` | `packages/epistemic/domain/src/entities/CandidateClaim/CandidateClaim.model.ts` | reuse: elements enter as candidates |
| `@beep/law-practice-domain` `Rejection`, `Distinction`, `DistinctionDetail` | `packages/law-practice/domain/src/entities/{Rejection,Distinction}/` | consumers: element references replace free text |
| `@beep/law-practice-domain` `KgNodeKind` | `packages/law-practice/domain/src/values/KgNodeKind/KgNodeKind.model.ts` | extend later (element node kinds) |
| claim-element schema, antecedent checker, element mapping record, IPRally adapter, strict graph metric | — | NET-NEW |

## 5. Cross-links & provenance

- This packet: [CAPTURE.md](../CAPTURE.md), [RESEARCH.md](../RESEARCH.md),
  [OPPORTUNITIES.md](./OPPORTUNITIES.md) (friction receipts).
- Prior synthesis: [research-corpus-synthesis](../../research-corpus-synthesis/README.md). Its
  ROUTING R2-062 is waiting on an OA claim-element consumer.
- Consumers:
  - [goals/patent-drafting-episode-ledger](../../../goals/patent-drafting-episode-ledger/README.md)
    (paused)
  - [goals/oa-evidence-consumer-conformance](../../../goals/oa-evidence-consumer-conformance/README.md)
    (paused)
  - [goals/law-practice-office-action-extraction-rung](../../../goals/law-practice-office-action-extraction-rung/README.md)
    (completed-retained)
- Schema owner: [goals/patent-document-schema](../../../goals/patent-document-schema/README.md)
  (completed-retained).
