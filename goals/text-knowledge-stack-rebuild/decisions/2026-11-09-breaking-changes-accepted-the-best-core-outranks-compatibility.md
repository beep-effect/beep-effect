---
title: "Breaking changes accepted: the best core outranks compatibility"
date: 2026-11-09
lane: "goals/text-knowledge-stack-rebuild"
pullRequest: 2993
reversal: "Reinstate the compatibility hedges by decision file before the affected phase starts: frozen persisted encodings with parallel new preimages, old-wire codecs for changed wire shapes, and renames deferred to a census gate."
---

Operator ruling, 2026-11-09, while PR #2993 was in review: "I'm totally ok with breaking changes. I'd rather have the best core that we can build than worry about what will break. We want the best core for this stuff & we can deal with breaking changes later." Consequences for this program: persisted identity encodings are re-minted through a migration rather than frozen beside new ones; legacy carriers (non-canonical anchor encodings, path-derived IRIs, the list-valued rdf.Dataset, language-tagged xsd:string literals, the handoff's Entity/Relation/Provenance types) are deleted, not kept as projections; package topology is decided in P0 and executed inside the layer phases rather than after a late census; no old-wire codecs are written for internal shapes. Repo doctrine that protects consumers still applies as text: every breaking public API or schema change ships with a major changeset, every retirement follows standards/architecture/11-evolution-and-deprecation.md with the consumer migration in the same PR, and P0 records a scoped DECISIONS.md amendment for the persisted-bytes clause instead of ignoring it. The critics' risk that effort goes to names before evidence is handled by keeping one office-action flow green at every phase exit from P3 on.
