# Claim Element Antecedent Check — Sources & Provenance

- **Source exploration:** `explorations/claim-element-graph` — primary ledger:
  [`explorations/claim-element-graph/research/SOURCES.md`](../../../explorations/claim-element-graph/research/SOURCES.md).
  That ledger records the 2026-10-14 sweep, the acquisition commands and the
  verify result. This file lists only the subset this goal's implementation
  needs; it does not copy the research.
- **Library:** originals, PDFs and repository clones stay in the external
  research library, addressed by the library IDs below. Nothing from it is
  committed here.

## 1. Mined source corpus

Nothing has been mined at `file:line` granularity yet. P2 records rows here
when it ports a rule or a record shape.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| — | — | — | — | — | — |

## 2. Upstream repositories & licenses

Licenses as read from the acquired clones (see the primary ledger §2).

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [ShangDataLab/FLAN-Graph](https://github.com/ShangDataLab/FLAN-Graph) | MIT | port-with-attribution | Deterministic element-tree rules; dependent-claim attachment through preamble identity (P2 decomposer) |
| [iprally/invention_graph_eval](https://github.com/iprally/invention_graph_eval) | MIT | port-with-attribution | 5k typed-label training sample as a non-US smoke test only (P3); no adapter |
| [boschresearch/pedantic-patentsemtech](https://github.com/boschresearch/pedantic-patentsemtech) | README says MIT code / CC-BY 4.0 data; no LICENSE file | reference-only until a LICENSE file exists | §112(b) reason taxonomy as a cross-check for finding kinds |
| [LGAI-Research/PANORAMA](https://github.com/LGAI-Research/PANORAMA) | CC BY-NC 4.0 | reference-only; internal evaluation only, never shipped | Optional internal US per-claim evaluation; repo keeps derived metrics and source IDs only |

## 3. External research sources

Library IDs from the primary ledger §3.

| Use in this goal | Source | Library ID |
| --- | --- | --- |
| Decomposer rules (P2) | [arXiv 2404.14372](https://arxiv.org/abs/2404.14372) — FLAN-Graph | `5c9126707cf5` |
| Antecedent edges, `a/an` vs `the/said` (P0, P2) | [arXiv 2605.10073](https://arxiv.org/abs/2605.10073) — PHAGE | `b95061277e62` |
| Antecedent consistency as a structural measure (P3) | [arXiv 2607.24040](https://arxiv.org/abs/2607.24040) — SPG | `bce67ebbaf03` |
| Target miss class: cross-claim and nested chains (P2, P3) | [arXiv 2604.04295](https://arxiv.org/abs/2604.04295) — ACE §112(b) cascade | `6f6e862c9f41` |
| §112(b) reason taxonomy, recitation re-anchoring (P0, P3) | [arXiv 2505.21342](https://arxiv.org/abs/2505.21342) — PEDANTIC | `c177c4acdd98` |
| Strict vs lenient structural scoring (P3 primary metric) | [arXiv 2607.28532](https://arxiv.org/abs/2607.28532) — MarkushGlyph | `5654d892dab8` |
| Verbatim spans keep modal/qualifier meaning (P0 `TextAnchor`) | [arXiv 2608.12326](https://arxiv.org/abs/2608.12326) — Semantic Preservation | `a4ccfce2f0ad` |
| Anchor context and IPRally data census (P3 smoke test) | [arXiv 2610.01553](https://arxiv.org/abs/2610.01553) — From Rules to Neural Graphs | `8cb976d59fab` |
| Internal evaluation only (NC) | [arXiv 2510.24774](https://arxiv.org/abs/2510.24774) — PANORAMA | `efcc86a518a2` |

Background only, per the exploration's
[`research/CATALOG.md`](../../../explorations/claim-element-graph/research/CATALOG.md):
the remaining acquired and verified papers.

## 4. In-repo capability references

| Brick | Path | Disposition |
| --- | --- | --- |
| `PatentClaim`, `PatentClaimTransition`, `inspectPatentClaimDependencies`, `PatentClaimDependencyIssue` | `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts` | read-only input; copy the diagnostic pattern |
| `PatentDocument.normalizer` | `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.normalizer.ts` | reuse for draft input; role-file precedent |
| `TextAnchor` | `packages/foundation/modeling/provenance/src/TextAnchor.ts` (`@beep/provenance`) | reuse for element and term spans |
| `PatentClaimCandidate` | `packages/law-practice/use-cases/src/PatentClaimCandidate/PatentClaimCandidate.ts` | extend or mirror at element granularity |
| `KgCandidateClaimsTool` and the read-tool toolkit | `packages/law-practice/use-cases/src/PracticeKg.tools.ts` | add the findings read tool beside it |
| `CandidateClaim`, `Evidence`, `ClaimDisposition` | `packages/epistemic/domain/src/entities/` (`@beep/epistemic-domain`) | reuse; findings enter as candidates, verdicts as dispositions |
| `Uspto` service (`getDocuments`, `downloadDocument`) | `packages/drivers/uspto/src/Uspto.service.ts` (`@beep/uspto`) | adapter source, consumed from `@beep/law-practice-server` |
| `ReviewItem`, `VerdictRow` (P1); `VerdictProjector` (P2) | `goals/review-verdict-envelope` | consume the schema after P1 and the projection after P2 |
| Element schemas, decomposer, checker, USPTO claims adapter, strict graph metric, labelled fixtures | — | NET-NEW |

## 5. Cross-links & provenance

- Exploration: [README](../../../explorations/claim-element-graph/README.md),
  [BRIEF](../../../explorations/claim-element-graph/BRIEF.md),
  [DECISIONS](../../../explorations/claim-element-graph/DECISIONS.md),
  [MAP](../../../explorations/claim-element-graph/MAP.md),
  [RESEARCH](../../../explorations/claim-element-graph/RESEARCH.md),
  [SWEEP report](../../../explorations/claim-element-graph/research/SWEEP-2026-10-14.md),
  [anchor deep-dive](../../../explorations/claim-element-graph/research/ANCHOR-2610.01553.md).
- Review surface: [explorations/attorney-review-workspace](../../../explorations/attorney-review-workspace/README.md)
  and [goals/review-verdict-envelope](../../review-verdict-envelope/README.md).
- Schema owner: [goals/patent-document-schema](../../patent-document-schema/README.md).
- Later consumers (gated): [goals/patent-drafting-episode-ledger](../../patent-drafting-episode-ledger/README.md),
  [goals/oa-evidence-consumer-conformance](../../oa-evidence-consumer-conformance/README.md).
