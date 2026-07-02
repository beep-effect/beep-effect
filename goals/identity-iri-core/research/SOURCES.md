# Identity IRI Core — Sources & Provenance

Inherited from the graduating exploration. **Primary ledger:**
[`explorations/identity-as-iri/research/SOURCES.md`](../../../explorations/identity-as-iri/research/SOURCES.md)
— repo licenses/port discipline (§2), official spec sources (§3), in-repo
bricks (§4). This file reproduces the implementation-relevant subset for
this packet; when in doubt, the exploration ledger wins.

## What this packet builds from

| Source | Role | Discipline |
| --- | --- | --- |
| [`scratchpad/identity/{Vocab,Curie,PnLocal,Composer}.ts`](../../../scratchpad/identity/) | Port donors — proven prototype (27/27 tests, effect-only) | Our code; adapt with house JSDoc |
| [`explorations/identity-as-iri/research/11-audit-identity-coupling.md`](../../../explorations/identity-as-iri/research/11-audit-identity-coupling.md) | Preserve-exactly surface (named imports, make() compat, codegen templates) | Test-pin before rewrite |
| [`explorations/identity-as-iri/research/specs/01-iri-uri-curie.md`](../../../explorations/identity-as-iri/research/specs/01-iri-uri-curie.md) | RFC 3986/3987 + CURIE 1.0 grounding for the type machinery | Cited spec prose |
| [`explorations/identity-as-iri/research/specs/02-rdf-turtle-jsonld.md`](../../../explorations/identity-as-iri/research/specs/02-rdf-turtle-jsonld.md) | Turtle PN_LOCAL grammar for the codec | Cited spec prose |
| [`explorations/identity-as-iri/research/specs/03-vocabularies.md`](../../../explorations/identity-as-iri/research/specs/03-vocabularies.md) | Registry term inventories (rdf/rdfs/skos/owl/dcterms) | Cited spec prose |
| `packages/foundation/modeling/rdf/src/Vocab/*` | Registry reconciliation target (drift TEST only — no runtime import) | In-repo brick |
| [`explorations/identity-as-iri/research/20-repo-mining-synthesis.md`](../../../explorations/identity-as-iri/research/20-repo-mining-synthesis.md) + [`21-synthesis-adversarial-review.md`](../../../explorations/identity-as-iri/research/21-synthesis-adversarial-review.md) | Corpus evidence (read together with the arbitration in the exploration `RESEARCH.md`) | Verified synthesis |
| n3 / rdfjs-types reports ([`research/repos/`](../../../explorations/identity-as-iri/research/repos/)) | PN_LOCAL writer policy + literal-preserving factory patterns | MIT — port-with-attribution |
| n3-types / skygest / dxos reports | Type tricks + patterns | REFERENCE-ONLY — clean-room, never code |

## License wall (from the primary ledger)

MIT/Apache verified (port-with-attribution): effect-ontology, ontosphere,
rdflib.js, Ontorite, ontograph-core, ontology-master, OWL-FOL-translator, n3,
rdfjs-types. REFERENCE-ONLY: dxos (FSL-1.1-Apache-2.0), skygest (unverified),
n3-types (unverified).

## Cross-links

- Exploration packet: [`explorations/identity-as-iri`](../../../explorations/identity-as-iri/README.md)
  (manifest `links.goals` points here; `provenance.exploration` in this
  packet's manifest points back).
- Design authority: [`identity-iri-fibration-handoff.md`](../../../explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md) (D1–D9).
- Decisions binding this packet: packaging seam, SemanticSchemaMetadata
  layering, $I.key struct-only, IdentityRegistry naming, authority-host
  deferral — all in
  [`explorations/identity-as-iri/DECISIONS.md`](../../../explorations/identity-as-iri/DECISIONS.md).
- Queued siblings: `identity-iri-fold`, `identity-iri-fibered` (see
  [`MAP.md`](../../../explorations/identity-as-iri/MAP.md)).
