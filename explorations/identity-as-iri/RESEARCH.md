# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## 2026-07-01 — Standards corpus (official specs, prose for implementers)

Collected by codex agents from the official documents; every claim carries a
section citation and each doc ends with a fetched-yes/no sources table.

- [`research/specs/01-iri-uri-curie.md`](./research/specs/01-iri-uri-curie.md)
  — RFC 3986 (URI), RFC 3987 (IRI), W3C CURIE Syntax 1.0, RDFa Core prefix
  mechanism; slash/hash fragment semantics; design implications for
  `IriFromIdentity` / `CurieFromIdentity` / `Expand`.
- [`research/specs/02-rdf-turtle-jsonld.md`](./research/specs/02-rdf-turtle-jsonld.md)
  — RDF 1.1 Concepts, Turtle grammar (PNAME/PN_LOCAL productions + escape
  sets), JSON-LD 1.1 (contexts, @vocab, @reverse, compact-IRI slash
  behavior); Turtle writer escaping table and context-generation rules.
- [`research/specs/03-vocabularies.md`](./research/specs/03-vocabularies.md)
  — registry term inventories for rdf:/rdfs:/skos:/owl:/dcterms:; SKOS
  S-numbered integrity conditions (hard-fail vs warning); OWL punning;
  dcterms migration + ranges; SHACL property-shape essentials; PROV-O seed.

## 2026-07-01 — Repo-mining corpus (12 repos, 1 report each)

One codex miner per repo (deep / standard / narrow tiers per
[DECISIONS grilling of 2026-07-01](../../.claude/plans/)), reports in
[`research/repos/`](./research/repos/): dxos-semantic-index, effect-ontology,
n3, n3-types, ontograph-core, ontology-master, ontorite, ontosphere,
owl-fol-translator, rdfjs-types, rdflib-js, skygest. Licenses verified
per-repo (see [`research/SOURCES.md`](./research/SOURCES.md) §2).

Synthesis: [`research/20-repo-mining-synthesis.md`](./research/20-repo-mining-synthesis.md)
(diamonds matrix, rough gallery, D1–D9 decision pressure, open-question
input, 12-step prototype guidance, license ledger).

Adversarial verification:
[`research/21-synthesis-adversarial-review.md`](./research/21-synthesis-adversarial-review.md)
— 7 CONFIRMED-ERROR, 2 QUESTIONABLE, license ledger CLEAN. Overall: synthesis
trustworthy for high-level decisions **after** the corrections below.

### Arbitration (orchestrator rulings on the adversarial findings)

All findings ACCEPTED. Read the synthesis together with these corrections:

1. **Restore dropped diamonds** — DXOS: provenance/valence channel
   separation, query-time conflict handling, source-cursor maintenance,
   graph-adapter/pullback shape (clean-room; FSL). Skygest: deterministic
   vendored-vocabulary generation + drift tests (clean-room). Ontosphere:
   dataset-faithful N-Quads/TriG exports with canonical hash checks,
   reasoning+validation+repair loop, provenance excluded from semantic
   reasoning/export by default (Apache-2.0).
2. **Split the SHACL row** — "generation/validation separate from authoring"
   → ontograph-core; "structured report data with severity policy" →
   effect-ontology + skygest.
3. **Retrieval nuance** — exact indexed retrieval is supported by rdflib and
   the ID-first parts of DXOS; DXOS fuzzy predicate matching and Skygest
   AI-search projections are separate discovery surfaces, NOT registry
   behavior.
4. **D7 stays open by authority** — Skygest gives entity-local ergonomics
   pressure, Ontorite warns against second channels; fold-first ordering
   comes from the handoff, not corpus consensus.
5. **PN_LOCAL codec is Phase 1, not deferred** — build the shared codec on
   n3's parser-side acceptance model; the Turtle WRITER policy starts as
   full-`<IRI>` fallback for unsafe locals (n3 + rdflib convergence), with
   escaped-local emission later.
6. **§8 migrations get an execution slot** — handoff §8 retro-fixes
   (`identifier` overloading, `parent_class_of` direction, dcterms, MADS)
   are Phase 3 acceptance criteria with idempotent migration/sweep tests
   (Ontorite lesson).
7. **Dataset-faithful proof lane** — deferred until named-graph partitions
   enter the assembled value; deferral is explicit, not omitted.

## 2026-07-01 — In-Repo Capability Inventory (audits)

- [`research/10-audit-semantic-schema-metadata.md`](./research/10-audit-semantic-schema-metadata.md)
  — every SemanticSchemaMetadata writer/reader in `@beep/rdf` +
  `@beep/semantic-web`, with absorb/layer/deprecate recommendation and
  migration cost.
- [`research/11-audit-identity-coupling.md`](./research/11-audit-identity-coupling.md)
  — `@beep/identity` purity today, create-package codegen template coupling,
  repo-wide import blast radius, and the exact surface a shape-stable
  rewrite must preserve.
- [`research/12-audit-goals-supersession.md`](./research/12-audit-goals-supersession.md)
  — confirms `goals/ontology-modeling-foundation` specs the dead
  `Ontology.create` design; exact (unapplied) supersession edit; overlap
  check against `goals/ontology-interop-roadmap`.

Prior in-repo findings (exploration report, `assets/`): `$I`/IdentityComposer
at `packages/foundation/modeling/identity/src/Id.ts`; `@beep/rdf`
Iri/Uri/Curie/PrefixMap/Vocab; `@beep/ontology` holds FOLIO
`Ontology.models.ts`; EntityId (branded ints) orthogonal.

## Constraints Discovered

- License wall: dxos (FSL-1.1-Apache-2.0), skygest (unverified), n3-types
  (unverified) are REFERENCE-ONLY — patterns clean-room, code never ported.
  Everything else MIT/Apache-2.0 port-with-attribution.
- RDF/JS interop wants term OBJECTS (`NamedNode<Iri>` with termType/equals),
  not bare strings → keep core IRI literal-typed; provide a boundary
  wrapper/factory (rdfjs-types report §6–§7).
- Turtle writers in the wild do not escape slash/dot PN_LOCALs; they fall
  back to full IRIs — our slash-heavy IRIs will mostly emit as `<IRI>` in
  prefixed-name-capable serializers (n3 report §4).
- Codex operational constraint (meta): tasks >~8 min must launch in
  background mode; deliverable-on-disk is the only reliable contract.
