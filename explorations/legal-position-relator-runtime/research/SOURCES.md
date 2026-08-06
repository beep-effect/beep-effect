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
mined for this wedge; links, not copies. Lane B recorded its verification
verdicts 2026-08-05: `P100` → `verified-with-correction` (frames verbatim;
the "transition semantics over Hohfeldian relators" claim is false as
written; beep-fit partial — eFLINT execution semantics excluded —
[`02-position-relator-legal-frame.md`](./02-position-relator-legal-frame.md) §2);
`R25` → `verified`, all four gates pass (§3). The parent ledger's rows were
promoted 2026-08-06 with the align outcomes (dated verification descriptors,
recommendation `adopt`) — a parent-packet act landing in the same PR as this
file.

## 2. Upstream repositories & licenses

- `flint-ontology` — VERIFIED 2026-08-05 on the real repository: TNO GitLab
  (`normativesystems/knowledge-modeling/flint-ontology`, © TNO 2022, v1.0.0
  dated 2025-12-03) — the repo lives on GitLab, not GitHub. License split
  confirmed on the LICENSE files themselves: top-level **Apache-2.0**
  (port-with-attribution), `shacl/` **MPL-2.0** (clean-room re-expression
  only). Per-portion discipline table:
  [`02-position-relator-legal-frame.md`](./02-position-relator-legal-frame.md) §3.
  The pre-existing `ShaclSeverity` in `@beep/semantic-web` narrows what the
  wedge would *want* from `shacl/` (the severity split is already owned) but
  does not narrow the obligation: anything taken from either `shacl/*.ttl`
  file is clean-room-only regardless of novelty, per MPL §1.4 file-level
  scope — no copying of shape text, SPARQL constraint bodies, or file
  structure — and the clean-room derivation must be recorded in the
  graduated goal packet. No vendoring. `flint-ontology` is the wedge's single
  code donor.
- The UFO-L and FLINT/eFLINT **papers** are cited, never vendored. Only the
  CEUR demo paper is CC BY 4.0; CALCULEMUS, the ILLC thesis, and the eFLINT
  arXiv author-version carry no reuse licence — no figures or extended
  passages may be copied into repo docs (Lane B §2.5, §9).

## 3. External research sources

Populated 2026-08-05 by Lane B — the full per-URL ledger with access dates is
[`02-position-relator-legal-frame.md`](./02-position-relator-legal-frame.md) §9
(Sources), with failed/unverifiable fetches recorded in §8 (NOT FOUND / NOT
VERIFIED) rather than papered over. Source families: Hohfeld 1913 + 1917 from
Yale's own repository (`openyls.law.yale.edu`, public domain; the
`digitalcommons.law.yale.edu` host does not exist and
`elischolar.library.yale.edu` returns 403 — both recorded), published FLINT /
eFLINT papers (van Doesburg & van Engers and successors), the TNO
`flint-ontology` GitLab repo (§2 above), and published UFO-L papers (Griffo,
Almeida, Guizzardi). Every citation in the lane file was actually opened;
Wikisource used only as an independent cross-check of the Hohfeld tables.

## 4. In-repo capability references

Populated 2026-08-05 by Lane A ([`01-repo-surfaces.md`](./01-repo-surfaces.md))
— grounded file:line map of all seven composed surfaces, net-new
re-confirmation (§8), nugget reconciliation (§9), and drift attribution
against the 2026-08-01 seed grounding (§10, headline: contradiction triage is
live code since PR #520, 2026-08-02; three citation corrections to the
inherited grounding are recorded there). Known at capture (from the routing
seed's grounded rows, now superseded by the lane file where they differ):

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
