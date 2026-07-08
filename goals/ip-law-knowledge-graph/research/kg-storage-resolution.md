# KG Storage Resolution: Projection over FalkorDB

Freshness: 2026-07-08.

The FalkorDB-vs-projection open question flagged by this packet's P0 (see
[`ontology-grounding-corpus.md`](./ontology-grounding-corpus.md), added
2026-06-11) has been resolved **in favor of a Postgres/PGlite projection** by
the [`legal-document-intake`](../../legal-document-intake/README.md) packet
(decision D6 in its `SPEC.md`, locked 2026-07-08).

## Decision

Knowledge-graph nodes and edges are schema-first tables in Postgres (PGlite in
the desktop runtime), embeddings live in pgvector, and two-hop traversal is
recursive SQL. A dedicated graph database (FalkorDB or otherwise) remains a
later optimization behind the same port, adopted only if projection query
performance fails observed targets.

## Rationale

- The consuming product (`apps/professional-desktop`) is local-first: PGlite
  in-app, Postgres in dev. A graph-DB sidecar or Docker dependency contradicts
  the desktop deployment model.
- The `epistemic` slice already persists claims/provenance in Postgres tables;
  admitted claims materializing as KG rows keeps one storage engine and one
  transactional boundary.
- pgvector is already provisioned in docker-compose (and supported by PGlite
  as an extension), so hybrid semantic+symbolic search needs no second store.
- No FalkorDB driver exists in the repo; adopting it would put a net-new
  driver on the critical path of a product feature.

## Consequences for this packet

- P0's storage-posture question is closed; subsequent phases should target
  schema-first node/edge tables + recursive SQL, not Cypher.
- Ontology grounding work (FOLIO/LKIF IRIs) is unaffected — concept IRIs are
  stored as data on nodes/edges and stay interop-ready.
- If a future phase demonstrates projection limits (deep traversals, graph
  algorithms), reopen with benchmarks; the port boundary in
  `legal-document-intake` D6 is the seam a graph DB would slot into.
