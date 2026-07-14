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

M1 Intake-Serving Semantic Seed. Next concrete action: implement the
repo-owned SKOS taxonomy seed and the `@beep/ontology` taxonomy registry/loader
surface described in [`SPEC.md`](./SPEC.md), using the legal exploration's
research directory as feeder input rather than copying it into this packet.

## Latest Evidence

Not started.

## Provenance Notes

- Graduated 2026-07-08 from
  [`explorations/legal-ontology-landscape`](../../explorations/legal-ontology-landscape/README.md).
- The source exploration stays `active` until P1-P4 research lands; those
  reports feed this packet's later research verdicts and do not widen M1 unless
  `SPEC.md` changes.
- The older ontology-survey scope is absorbed here by decision from
  [`explorations/legal-ontology-landscape`](../../explorations/legal-ontology-landscape/README.md);
  its packet was removed 2026-07-14, so the former no-edit fence is moot.
