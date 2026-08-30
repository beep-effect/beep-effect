# Practice Mail Backfill — Sources & Provenance

- **Source exploration:** `explorations/practice-office-provisioning` —
  primary ledger:
  [`explorations/practice-office-provisioning/research/SOURCES.md`](../../../explorations/practice-office-provisioning/research/SOURCES.md)
  (per-lane URL registry in
  [`SOURCES-lane-citations.md`](../../../explorations/practice-office-provisioning/research/SOURCES-lane-citations.md)).
  This file reproduces the implementation-relevant slice; the exploration's
  ledger stays canonical.
- **Provenance:** R2 Grok lane + r5 SKU preflight + the r7 Sol Pro gap
  report + the live `subscribedSkus` probe, all 2026-08-30.

## 1. Mined source corpus

No upstream code is mined or ported. This is a
documentation-and-operations goal.

## 2. Upstream repositories & licenses

None — no dependencies are added.

## 3. External research sources

Carried by the exploration lane reports (each with its own Sources section on
disk):

- [`r2-purview-pst-import.md`](../../../explorations/practice-office-provisioning/research/r2-purview-pst-import.md)
  — the runbook authority: network-upload + AzCopy mechanics (staging-form /
  mapping-CSV pairing, nested-PST flat-upload caveat), `IsArchive=TRUE` +
  `TargetRootFolder` rules, throughput and per-PST limits, retention-hold
  behavior, the 100 GB ceiling and the auto-expansion documentation
  conflict (§2.5).
- [`r5-sku-preflight-and-process.md`](../../../explorations/practice-office-provisioning/research/r5-sku-preflight-and-process.md)
  — SKU gating matrix and preflight stop conditions.
- [`r7-sol-pro-gap-report.md`](../../../explorations/practice-office-provisioning/research/r7-sol-pro-gap-report.md)
  — §A: license belongs on the target-mailbox user; EOP2 seat as cheapest
  verified path; Purview-Suite-for-BP alternative; operational adjudication
  of the auto-expand conflict (support case still required).

## 4. In-repo capability references

| Brick | Path | Mark |
|-------|------|------|
| Exploration decision log (mail modality, SKU, import-rights path) | `explorations/practice-office-provisioning/DECISIONS.md` | binding |
| Salvage estate preservation (source PSTs) | `goals/oppold-corpus-salvage-restoration` | upstream dependency (preserved media only; no corpus processing needed) |

## 5. Cross-links & provenance

- Exploration: [`explorations/practice-office-provisioning`](../../../explorations/practice-office-provisioning/README.md)
  — `DECISIONS.md` (binding), `BRIEF.md` (sketch point 3 + the appetite
  carve-out), `MAP.md` (sequencing: P0 runs immediately in parallel).
- Sibling goals: [`goals/practice-m365-contacts`](../../practice-m365-contacts/README.md)
  (the only other approved M365 write surface),
  [`goals/practice-box-provisioning`](../../practice-box-provisioning/README.md).
- Downstream: curated per-matter mail filing into Box belongs to the corpus
  chain, not this goal.
