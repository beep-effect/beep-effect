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

Closed after M1-M3 on 2026-10-09 with version-pinned classification, docketing
and separate party-kind/legal-role vocabulary contracts. M4 remains gated and routed to legal-document-intake P4.

## Latest Evidence

### M2 complete, wave 1 (2026-10-09)

- All 90 package tests, package audit/docgen and test-tsgo pass.
- Full official editions load: IPC 2026.01 has 80,145 concepts, CPC 2026.08
  has 254,314, and Nice 13-2026 has 10,168. CPC retains identifier/title facts.
- Real-manifest M1 regression preserves nine concepts and the vetted FOLIO
  email alignment; IPC/CPC identities remain distinct and Nice terms resolve.
- Coverage remains above unchanged aggregate floors; only lane-created rows
  are added under R4. M3 is complete, lifecycle completed-retained, M4 pending.
- [Append-only handoff](./history/handoffs/semantic-m2m3-2026-10-09.md) retains
  the proof table, checksums, source heads and publication receipts.

### Retained M1 evidence

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

### M3 complete and packet closeout (2026-10-09)

- 42 terms in three explicit version-1.0.0 schemes; TTL/JSON-LD/TS parity,
  every pinned notation and CQ 1/5/7/8/18 fixtures pass in Vocabulary.test.ts.
- All 97 package tests pass; M3 production files have 100% coverage. Package
  audit/docgen pass (12.0s / 6.0s), reflection lint has zero findings.
- [Frozen contract](./research/2026-10-09-m3-vocabulary-contract.md) retains
  all IRIs, deprecation rules, source boundaries and the read-only bootstrap
  plan. No trademark packet was created.
- Wave 1 [#1598](https://github.com/beep-effect/beep-effect/pull/1598) run
  [38007435907](https://github.com/beep-effect/beep-effect/actions/runs/38007435907)
  has inherited Repo Sanity private changeset failures and Vercel rate limits;
  Heavy checks were queued at closeout. Exact final-head state is retained in
  the handoff after publication.
- Root docgen:local fails on unchanged scratchpad displayWidth.ts ES2024 regex
  examples. Ontology package docgen passes. The final parity receipts distinguish
  this inherited root failure from the package result.
- [Closeout reflection](./history/reflections/2026-10-09-codex.md).
