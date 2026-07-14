# Semantic Foundation

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Build the repo-owned semantic foundation that intake, filing, classification,
docketing, and party-role workflows can consume: SKOS concept schemes minted
under `https://ns.beep.sh/`, FOLIO alignments where vetted, and an
`@beep/ontology` registry/loader surface that can load committed seed data plus
approved vendor slices without adding a graph store or SPARQL engine.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/semantic-foundation/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active sequencing plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/README.md`](./research/README.md) - pointer to feeder research.
6. Source exploration:
   [`explorations/legal-ontology-landscape`](../../explorations/legal-ontology-landscape/README.md)
   - decisions, brief, decomposition, and pending P1-P4 research reports.

## Current Phase

M1 Intake-Serving Semantic Seed is complete. M2-M4 remain gated; the next
action is the operator-owned P3 verification and publish flow.

## Latest Evidence

- `@beep/ontology`: 2 test files and 11 tests pass.
- `@beep/identity`: 6 test files and 63 tests pass.
- Ontology source/test and identity TypeScript project checks pass.
- Effect function/import laws and fallow boundary configuration checks pass.
- No vendor slice is live-wired: research names no slice `VETTED` for loading,
  so package-local fixtures prove the fail-closed loader contract.
- `config-sync:check` is green after the operator applied the single managed
  change it actually required (`packages/foundation/modeling/ontology/docgen.json`);
  the implementation lane's repo-wide 110-file sync attempt was a misfire and
  its invalid blank-file edits were correctly restored.
- R1 reconciliation caveat: the loader's `VendorManifestEntry` load-manifest
  shape (`id`/`path`/`format:"jsonld"`/`loadStatus`) is intentionally narrower
  than the exploration asset pack's fetch-metadata `manifest.jsonl`; pointing
  the loader at the real manifest today fails closed with a parse error. R1
  must either extend the asset-pack manifest with load fields or introduce a
  dedicated load manifest before any live vendor slice is wired.

## Provenance Notes

- Graduated 2026-07-08 from
  [`explorations/legal-ontology-landscape`](../../explorations/legal-ontology-landscape/README.md).
- The source exploration stays `active` until P1-P4 research lands; those
  reports feed this packet's later research verdicts and do not widen M1 unless
  `SPEC.md` changes.
- The older ontology-survey scope is absorbed here by decision from
  [`explorations/legal-ontology-landscape`](../../explorations/legal-ontology-landscape/README.md);
  its packet was removed 2026-07-14, so the former no-edit fence is moot.
