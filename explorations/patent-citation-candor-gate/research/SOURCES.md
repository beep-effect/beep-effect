# Patent Citation Candor Gate — Sources & Provenance

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

- **Cluster / origin:** the "Patent citation events and candor disposition"
  cluster of the parent campaign's signed-off routing matrix
  (`explorations/legal-patent-kg-deepening/routing-seed.json`, wave P1).
- **Provenance:** parent ledger
  [`nugget-catalog.json`](../../legal-patent-kg-deepening/research/nugget-catalog.json)
  (46 rows); this packet consumes nuggets `T2-F2`, `T3-F7`, `ADHD-1`.

## 1. Mined source corpus

Inherited by reference from the parent campaign — the nuggets' distillates
live in `explorations/legal-patent-kg-deepening/research/mined/` (T2-F2:
P017, P006, P041; T3-F7: P064, P074, L14, P099; ADHD-1: /adhd frames spee6,
regu3, onca4, comp3 in `research/20-adhd-integration.md`). No new corpus is
mined for this wedge; links, not copies.

## 2. Upstream repositories & licenses

None yet — the wedge composes in-repo bricks; no external repo is a donor at
capture stage.

## 3. External research sources

To be populated by research Lane B (bounded public-primary-source candor
legal frame: 37 CFR 1.56 / 1.97 / 1.98, MPEP 2001 / 609, Therasense) →
`research/02-candor-legal-frame.md`.

## 4. In-repo capability references

To be populated by research Lane A (`research/01-repo-surfaces.md`). Known at
capture (from the routing seed's grounded rows):

- `@beep/law-practice-domain` — `PatentMetadata` (`PatentReference`),
  `PriorArtReference`, `Claim` — reuse/extend.
- `@beep/provenance` (foundation/modeling/provenance) — `TextAnchor`,
  `VerifiedTextAnchor` — reuse.
- `@beep/epistemic-domain` — `EvidenceSpan` — reuse.
- `@beep/agents-use-cases` — `ProfessionalRuntime` contracts
  (`RuntimeCandidateDraft`, `RuntimeApprovalGate`) — compose.
- `PatentCitationEvent`, `CandorDisposition`, `PatentFragmentLocator` —
  NET-NEW (zero symbols in source as of the 2026-08-01 rg sweep).

## 5. Cross-links & provenance

- Parent packet: [`../../legal-patent-kg-deepening/README.md`](../../legal-patent-kg-deepening/README.md)
  (routing seed, nugget ledger, /adhd artifact, campaign DECISIONS).
- Composed goal SPECs: `goals/citation-extraction-engine`,
  `goals/citation-verified-span-substrate`, `goals/uspto-prosecution-read`,
  `goals/agentic-professional-runtime`.
- This packet's decision log: [`../DECISIONS.md`](../DECISIONS.md); capture:
  [`../CAPTURE.md`](../CAPTURE.md).
