# Patent Drafting Episode Ledger — Sources & Provenance

<!--
The provenance ledger for this packet. Start it in the `research` stage and keep
it current through graduate; the graduated goal inherits a copy.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk in RESEARCH.md / research/*.md; if a claim has no on-disk URL,
  cite the RESEARCH.md section that carries it instead.
- Licenses are load-bearing; state the discipline per repo.
- Register this file in ops/manifest.json `exploration.sources`.
-->

- **Clusters / origin:** the merged "Drafting episodes, deterministic
  retrieval, and rebuildable projections" cluster, which absorbed
  "Claim-limitation support and governed patent drafting" as its first rung
  in the 2026-08-01 reconciliation grill, of the parent campaign's
  signed-off routing matrix
  (`explorations/legal-patent-kg-deepening/routing-seed.json`, wave P1, one
  merged row).
- **Provenance:** parent ledger
  [`nugget-catalog.json`](../../legal-patent-kg-deepening/research/nugget-catalog.json)
  (46 rows); this packet consumes nuggets `T1-F10`, `T3-F4`, `T3-F5`,
  `T3-F10`, `T4-F7`, `ADHD-3` (primary) and `T4-F1`, `T4-F2`, `T4-F3`,
  `T4-F4`, `ADHD-2` (absorbed first rung).

## 1. Mined source corpus

Inherited by reference from the parent campaign — the nuggets' distillates
live in `explorations/legal-patent-kg-deepening/research/mined/` (see each
nugget's distillate list in [`CAPTURE.md`](../CAPTURE.md)). No new corpus is
mined for this wedge; links, not copies. The two deepened plays (`ADHD-2`,
`ADHD-3`) are not verified findings — research Lane B re-grounds their
boundary language against the primary public sources before align.

## 2. Upstream repositories & licenses

No external repository is a code donor at capture stage: the eleven nuggets'
distillates are papers and benchmarks, not portable code. If research Lane B
surfaces a code donor, it enters here with its license discipline (copyleft
⇒ clean-room only; permissive ⇒ port-with-attribution; missing/unverified ⇒
reference only) before any adoption.

## 3. External research sources

To be populated by research Lane B (bounded public-source grounding: the
35 U.S.C. § 112(a)/§ 132 + MPEP § 2163/§ 608.04 written-description/new-matter
frame; the public papers behind all eleven nuggets' distillates — the six
primary-cluster episode/retrieval sources plus the absorbed rung's drafting
traceability/evaluation/routing studies) →
`research/02-drafting-episode-frame.md`.

## 4. In-repo capability references

To be populated by research Lane A (`research/01-repo-surfaces.md`). Known at
capture (from the routing seed's grounded rows):

- `@beep/agents-use-cases` — `ProfessionalRuntime` contracts
  (`RuntimeCandidateDraft`, `RuntimeApprovalGate`, `RuntimeEvidenceRef`,
  activities, usage) and the law-patent-intake runtime fixture — compose.
  Anchor correction (2026-08-06): the seed's `:428-490` span covers
  `RuntimeCandidateDraft` (`:428-446`) and `RuntimeApprovalGate`
  (`:473-491`) only; `RuntimeEvidenceRef` sits at `:209-222`,
  `RuntimeActivity` at `:608-623`, `RuntimeUsageRecord` at `:645-655` —
  Lane A re-grounds every anchor.
- `@beep/epistemic-use-cases` — `ExecutionLedger` append-only/hash-chain
  service precedent — precedent, never rebuilt.
- `@beep/law-practice-domain` — `Claim` model (number, independent flag,
  patent-asset reference, full text; no limitation support) plus the live
  law-practice tables/migration lane opened by the candor implementation
  (PR #575) — compose and extend beside.
- `goals/agentic-professional-runtime` SPEC — candidate drafts, evidence,
  strict human approval, deterministic fixtures — binding contract.
- `goals/hybrid-retrieval-fusion-core` SPEC — deterministic weighted RRF,
  exact-literal priority, stable ties, span preservation — composed
  substrate, never rebuilt.
- `goals/practice-kg-mcp` SPEC — read-only IP-law KG surface, deterministic
  docket rows, span-grounded candidates — composed substrate.
- `goals/citation-verified-span-substrate` SPEC — exact source-versioned
  support anchors — reused, never recreated.
- remo2 lane: `PracticeKgQuery` rows-first contract, bounded
  `SparqlQueryService`, disposable in-memory `@beep/rdf` dataset sessions —
  resolved boundary, binding.
- remo3 lane: `standards/memory-architecture/04-decision-log.md`
  (2026-08-01 clarification) and
  `explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md`
  boundaries — resolved boundary, binding.
- `DraftingEpisode`, `MemoryProjection`, `AnswerProvenanceAnnex`,
  `LegalInferenceEvent`, `NormativeRow`, `ClaimLimitationSupportSet`,
  `DraftingOutline`, `DraftingRouteState` — NET-NEW (zero symbols in source
  as of the 2026-08-01 rg sweep).

## 5. Cross-links & provenance

- Parent packet: [`../../legal-patent-kg-deepening/README.md`](../../legal-patent-kg-deepening/README.md)
  (routing seed, nugget ledger, campaign DECISIONS).
- Sibling wedges (graduated, stable boundaries — never reopened from here):
  `goals/patent-citation-candor-gate` (SPEC + live implementation PR #575,
  including the law-practice migration precedent) and
  `goals/legal-position-relator-runtime` (SPEC).
- Composed goal SPECs: `goals/agentic-professional-runtime`,
  `goals/hybrid-retrieval-fusion-core`, `goals/practice-kg-mcp`,
  `goals/citation-verified-span-substrate`.
- Memory-architecture boundary:
  `standards/memory-architecture/04-decision-log.md` (2026-08-01 entry;
  its 2026-08-06 role-retirement entry passes operator dev-memory from
  Cognee to basic-memory + codegraph with the operator/product boundary
  explicitly unchanged).
- This packet's decision log: [`../DECISIONS.md`](../DECISIONS.md); capture:
  [`../CAPTURE.md`](../CAPTURE.md).
