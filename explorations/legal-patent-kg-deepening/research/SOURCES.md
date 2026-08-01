# Legal & Patent KG Deepening — Sources & Provenance

<!--
The provenance ledger for this packet. Start it in the `research` stage and keep
it current through graduate; the graduated goal inherits a copy. Purpose: let an
implementing agent trace every decision back to its origin — a mined source
(repo + file:line), an upstream repo + LICENSE, an external citation, or an
in-repo brick.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk in RESEARCH.md / research/*.md; if a claim has no on-disk URL,
  cite the RESEARCH.md section that carries it instead.
- Licenses are load-bearing: copyleft (AGPL/GPL/MPL) upstream is CLEAN-ROOM
  reimplement only (pattern, not vendored code); permissive (MIT/Apache/BSD) may
  be ported WITH attribution; missing/unverified LICENSE ⇒ treat as reference
  only. State the discipline per repo.
- Register this file in ops/manifest.json `exploration.sources`.
-->

- **Cluster / origin:** hand-curated intake corpus at
  `/home/elpresidank/YeeBois/research/legal-patent-ontology-knowledge-graph-and-related-research/`
  (~120 papers, ~24 cloned repos, `links.md` with 15 seed URLs), assembled
  2026-07-31 → 2026-08-01.
- **Provenance:** corpus inventory in [`../CAPTURE.md`](../CAPTURE.md);
  campaign design in [`../DECISIONS.md`](../DECISIONS.md). Wave-1 ledger:
  [`../../legal-ontology-landscape/`](../../legal-ontology-landscape/README.md).

## 1. Mined source corpus

<!-- Fills during mining waves: one row per unique paper/URL distillate, with
its distillate path under research/mined/ and track theme. -->

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| (pending) | mining wave 1 not yet launched | | | | |

## 2. Upstream repositories & licenses

<!-- Fills during repo triage: one row per corpus repo that survives triage,
with SPDX license and port discipline. Repos overlapping wave-1 holdings noted
delta-only. -->

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| (pending) | repo triage not yet launched | | |

## 3. External research sources

- `links.md` seed URLs (15) — reproduced into the catalog during wave 1;
  includes FIBO Legal Core, UFO-L project page, LegalRuleML 1.0 spec, and the
  FOPNet ResearchGate entry (priority thread).

## 4. In-repo capability references

See [`../RESEARCH.md`](../RESEARCH.md) § In-Repo Capability Inventory —
verified per-brick rows land here as mining cites them.

## 5. Cross-links & provenance

- Wave 1: [`legal-ontology-landscape`](../../legal-ontology-landscape/README.md)
  (graduated; standing conclusions) → execution in
  [`goals/semantic-foundation`](../../../goals/semantic-foundation/README.md).
- Artifact contracts: [`_gold-intake`](../../_gold-intake/ROUTING-SEED.md)
  v1 nugget catalog / routing-seed / handoff schemas.
- Campaign grill log: [`../DECISIONS.md`](../DECISIONS.md).
