# Semantic Foundation

## Status

Lifecycle: `completed-retained`

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
3. [`PLAN.md`](./PLAN.md) - retained sequencing and gate record.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/README.md`](./research/README.md) - pointer to feeder research.
6. Source exploration:
   [`explorations/legal-ontology-landscape`](../../explorations/legal-ontology-landscape/README.md)
   - decisions, brief, decomposition, and completed P1-P4 research reports.

## Current Phase

Closed after M1. The exploration's R1-R4 research feeds are complete. M2-M4
remain deliberately gated future capabilities and require a separate product
pull; the M1 launcher explicitly forbids pulling them into this packet.

## Latest Evidence

- The repo-owned seed contains nine legal-intake concepts, all six required
  document classes, and local-vault plus Box-mirror filing roots.
- The exploration asset pack contains 17 checksum-pinned rows. Its exact FOLIO
  Email Communication JSON-LD slice is `VETTED` for a `closeMatch` to the local
  email-message concept; all research-only rows remain ignored by the loader.
- A clean asset-pack fetch verified every recorded checksum. Loading that real
  manifest returned the nine-concept seed with exactly one FOLIO alignment on
  email-message.
- The fixture librarian loop emits the concept IRI, alignment, document class,
  and both filing paths. `@beep/ontology` has 4 test files / 67 passing tests;
  `@beep/identity` has 12 test files / 106 passing tests.
- Ontology and identity TypeScript checks, ontology lint, scoped docgen, the
  packet checks, reflection lint, and full `bun run beep yeet verify` are green.
- The closeout reflection is
  [`history/reflections/2026-08-27-codex.md`](./history/reflections/2026-08-27-codex.md).

## Provenance Notes

- Graduated 2026-07-08 from
  [`explorations/legal-ontology-landscape`](../../explorations/legal-ontology-landscape/README.md).
- The source exploration graduated after P1-P4 research landed. Those reports
  ground the retained M2-M4 gates and did not widen M1.
- The older ontology-survey scope is absorbed here by decision from
  [`explorations/legal-ontology-landscape`](../../explorations/legal-ontology-landscape/README.md);
  its packet was removed 2026-07-14, so the former no-edit fence is moot.
