# Legal Ontology Landscape Brief

## Problem

Legal-document intake needs shared semantic vocabulary before downstream
workflows can safely classify, file, validate, and later docket work. The repo
already has relevant bricks - SKOS/RDF vocabulary constants, identity-backed
IRIs, FOLIO OpenAPI models, bounded SHACL, ClaimGate, and a legal-document
intake packet - but there is no foundation-layer taxonomy registry that lets
those bricks agree on concept identity, FOLIO alignment, filing semantics, or
future IPC/CPC/Nice and docketing vocabularies.

The current risk is coupling vocabulary work to the older
`goals/ip-law-knowledge-graph` graph-store direction or to concrete
document-intake implementation. That would make shared semantics drift between
IP-law graph work, intake filing, ClaimGate, and future trademark docketing.

## Appetite

Ship one foundation goal first: M1 for intake-serving semantic seed and
registry capabilities. Keep the exploration active until P1-P4 research lands,
then feed later M2-M4 decisions from those reports.

## Solution Sketch

Graduate `goals/semantic-foundation` as the shared semantic layer. M1 commits a
repo-owned SKOS taxonomy seed with concept IRIs under `https://ns.beep.sh/`,
adds document-class vocabulary (`draft`, `redline`, `filed`, `received`,
`privileged`, `extracted-child`), records FOLIO alignments where vetted, and
adds `@beep/ontology` registry/loader APIs that load committed seed data plus
manifested vendor slices from the exploration asset pack.

The packet consumes existing repo capabilities:

- `@beep/rdf` already has SKOS constants for concepts, schemes, hierarchy, and
  match predicates.
- `@beep/identity` already binds `https://ns.beep.sh/` and exposes
  `IdentityComposer` plus `mergeVocab`.
- `@beep/ontology` currently has FOLIO OpenAPI models, so registry/loader is
  the net-new package capability.
- `@beep/semantic-web` already has bounded SHACL and an intentionally
  unsupported SPARQL live layer.
- `goals/legal-document-intake` owns concrete vault placement, Box sync, and
  ClaimGate consumer behavior.

## Rabbit Holes

- Pulling IPC/CPC/Nice into M1 before the August 5 metric or demo-day pull.
- Treating FOLIO as the repo source of truth instead of alignment metadata.
- Introducing a graph database or SPARQL engine to make taxonomy lookup feel
  more "semantic."
- Moving document-intake filing implementation into the foundation layer.
- Creating trademark/docketing domain entities before role/deadline vocabulary
  is stable.

## No-Gos

- No SPARQL engine wiring in V1.
- No graph store; Postgres/PGlite projection doctrine stands.
- No law-practice domain entities in this packet.
- No duplication of `goals/legal-document-intake` documents-slice work.
- No edits to `goals/ip-law-knowledge-graph` during this graduation.
- No tracked third-party TTL/OWL payloads.

## Source Note

This brief was drafted from the locked 2026-07-08 decisions supplied for this
graduation and live repo capability checks. The requested source files
`CAPTURE.md`, `research/01-direction-grounding.md`, and `assets/README.md` were
not present in this checkout at drafting time; reconcile this brief when those
inputs land.
