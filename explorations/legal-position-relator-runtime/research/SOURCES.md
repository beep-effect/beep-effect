# Legal Position Relator Runtime — Sources & Provenance

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

- **Clusters / origin:** the "Legal positions, relators, and authorized
  transitions" cluster (primary) plus the carried "Legal contradiction scope,
  priority, and correction deltas" cluster (re-routed 2026-08-04,
  compose-don't-widen) of the parent campaign's signed-off routing matrix
  (`explorations/legal-patent-kg-deepening/routing-seed.json`, wave P1).
- **Provenance:** parent ledger
  [`nugget-catalog.json`](../../legal-patent-kg-deepening/research/nugget-catalog.json)
  (46 rows); this packet consumes nuggets `T1-F1`, `T1-F2`, `T1-F7`, `T1-F9`,
  `T4-F6`, `P100`, `R25` (primary) and `T1-F3`, `T3-F9`, `T4-F8` (carried).

## 1. Mined source corpus

Inherited by reference from the parent campaign — the nuggets' distillates
live in `explorations/legal-patent-kg-deepening/research/mined/` (see each
nugget's distillate list in [`CAPTURE.md`](../CAPTURE.md)). No new corpus is
mined for this wedge; links, not copies. `P100` and `R25` remain
`unverified-addendum` until research Lane B verifies them.

## 2. Upstream repositories & licenses

- `flint-ontology` (per `R25`, catalogued in the parent ledger): mixed
  licensing — Apache-2.0 portions are port-with-attribution; MPL-2.0 SHACL
  behavior is clean-room-only if adopted. No vendoring; adoption gated on the
  Lane B verification pass. No other external repo is a donor at capture
  stage.

## 3. External research sources

To be populated by research Lane B (bounded public-source legal-theory
frame: Hohfeld's Yale Law Journal articles, published FLINT papers, published
UFO-L papers; never-compute boundary; P100/R25 verification) →
`research/02-position-relator-legal-frame.md`.

## 4. In-repo capability references

To be populated by research Lane A (`research/01-repo-surfaces.md`). Known at
capture (from the routing seed's grounded rows):

- `@beep/ontology` (foundation/modeling/ontology) — `LiteralKit` domains,
  SKOS mapping kinds, `TaxonomySeed`, `TaxonomyLoader` registry — reuse.
- `@beep/epistemic-domain` — `EdgeVersion` bitemporal substrate — compose,
  never widen.
- `@beep/epistemic-use-cases` — `EdgeAuthority` record/supersede ports,
  `ExecutionLedger` append-only precedent — compose.
- `@beep/agents-use-cases` — `ProfessionalRuntime` contracts
  (`RuntimeApprovalGate`, Party/Role surfaces) — compose.
- `goals/epistemic-contradiction-triage` SPEC — binding contract for the
  carried contradiction vocabulary — compose, SPEC never amended from here.
- `HohfeldPosition`, `LegalPositionRelator`, `PowerExercise`/`ActFrame`,
  `SlotCorrespondence`, `LegalScopeContext`, `PriorityBasis`,
  `CorrectionDelta` — NET-NEW (zero symbols in source as of the 2026-08-01
  rg sweep).

## 5. Cross-links & provenance

- Parent packet: [`../../legal-patent-kg-deepening/README.md`](../../legal-patent-kg-deepening/README.md)
  (routing seed, nugget ledger, campaign DECISIONS).
- Sibling wedge (graduated): `goals/patent-citation-candor-gate` — stable
  SPEC boundary reference, never reopened from here.
- Composed goal SPECs: `goals/epistemic-contradiction-triage`,
  `goals/semantic-foundation`, `goals/agentic-professional-runtime`.
- This packet's decision log: [`../DECISIONS.md`](../DECISIONS.md); capture:
  [`../CAPTURE.md`](../CAPTURE.md).
