# Map

<!--
Stage 4. Decomposition into candidate goal packets.
-->

## Candidate goal packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `research-library-ontology-core` | Rewrite `Library.schemas.ts` to named `S.Class` models with ontology annotations; `Library.service.ts` becomes the `Context.Service` contract and live layer; `research library ontology render` emits Turtle T-Box and SHACL shapes through the `@beep/ontology` fold; `verify` validates the catalog with `@beep/shacl`; views become SPARQL over `@beep/oxigraph`; versioned catalog migration with real-corpus replay against the two existing intakes | none | `@beep/ontology` (`fold`, `toTurtle`, `AssembledOntology`), `@beep/identity` (`Vocab`, `Curie`), `@beep/rdf` (`Prov`, `Evidence`, `Vocab/{Prov,Cito,Fabio,Skos,Dcterms,SchemaOrg}`), `@beep/shacl`, `@beep/oxigraph`, `@beep/n3`; `commands/Research/Library/*`. NET-NEW: `Vocab/Dcat.ts`, hop-depth derivation model, SKOS packet concept scheme, `accessClass` partition |
| `research-library-routes` | `packages/drivers/firecrawl` driver (via `bun run beep create-package`) with a native web route in `acquire`; Box adapter on `@beep/box` with per-file receipts; `import-result` methods `vidbee` and `alphaxiv`; per-hop inventory extraction and the routed-finding hop-2 gate with domain caps | `research-library-ontology-core` (hop model, route `prov:Plan`) | `@beep/box`, `Library.web.ts` validator, `Library.youtube.ts`, `Library.import.ts`, `Library.acquire.ts`, `op` shim for `op://BEEP_SECRETS/BEEP_SECRETS/AI_FIRECRAWL_API_KEY`. NET-NEW: Firecrawl driver, Box adapter, hop-gate policy config |
| `research-intake-2026-11` | Run the third intake: Box nightlies + Nov-5 aggregation + VidBee bundles + private archive partition (hop 0), hop 1 in full, gated hop 2; T1/T2/T3 mining to CiTO-typed, SKOS-routed findings; `/deep-research` per gap cluster; `/adhd` graduation portfolio; `COVERAGE.md` with per-hop denominators; routing amendments to live packets. Separate intake snapshot and T1-only triage for Box `IP_LAW_ONTOLOGY_RESEARCH` | both above | `research library inventory/qualify/acquire/verify/render/status`; academia T1/T2/T3 precedent; pools per AGENTS.md (luna, Junie, Opus 5.5). NET-NEW: `mine` commands (tier runners as library commands, not packet scripts) |

Gated candidates (not promised now; re-entry points):

- `epistemic-library-model-promotion` — move the library's finding/evidence
  model into `packages/epistemic/domain` once a second consumer exists.
- `legal-ontology-pile-deep-read` — T2 reads of the 449-PDF Box pile, fired
  when `legal-ontology-landscape`, `lynx-lkg-ontology-grounding` or
  `legal-patent-kg-deepening` names it.

## Sequencing

1. `research-library-ontology-core` first: every later surface depends on the
   model, and the migration must replay the October intakes before new bytes
   land. Includes the topology fix.
2. `research-library-routes` second; its Firecrawl driver can start in
   parallel once the hop/route model from (1) is committed (stacked PR).
3. `research-intake-2026-11` last; it is the proof the first two exist for.
   At most three open PRs across the three.

## First vertical slice

`research-library-ontology-core`, slice 1: the existing catalog of intake
`2026-10-06` round-trips through the new `S.Class` models unchanged (hash-equal
re-render), `research library ontology render` writes
`ontology/research-library.ttl` containing the `Source`, `SourceVersion`,
`Capture`, `Artifact`, `Occurrence`, `Finding` classes aligned to PROV-O and
CiTO, and `research library verify` runs the generated SHACL shapes over the
catalog projection with zero violations. Verified by the existing
`research-library-*.test.ts` suites plus one SHACL conformance test and one
hash-equality test on the rendered `index.md`.

## Open risks inherited from the brief

- Validator migration must be versioned and replayed on the real corpus
  before any acquisition.
- Phase vs kind must pass the foundational-auditor gate before T-Box emission.
- GitHub is never transitive; X bodies are not chased.
- Firecrawl driver envelopes must be byte-compatible with the existing
  validator.
- The private archive partition is a schema field, excluded from render by
  default.
- The Research command group will move under `beep-cli-composition`; keep
  the facade curated.
