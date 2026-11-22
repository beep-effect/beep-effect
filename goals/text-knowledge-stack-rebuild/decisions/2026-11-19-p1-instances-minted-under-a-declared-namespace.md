---
title: "P1: instance IRIs are minted under a declared term or namespace with the composer segment grammar (design D3)"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p1-l0-identity"
reversal: "Add a kind field to Namespace that separates term namespaces from instance namespaces, by a decision file."
---

D3 of the registry-first design, not replaced by a ruling. An instance IRI is minted under a declared term or namespace by Registry.mint(base, ...segments), which reuses the segment validation of create(...) moved to identity/src/internal/Segment.ts, so Registry.mint("practice-kg:" + kind, naturalKey) and graphIdentity.create(kind).create(naturalKey).iri (PracticeKg.projections.ts:285) produce the same bytes and refuse the same inputs; Registry.mintEncoded covers the encodeURIComponent form used by ClaimGate and the research library. The Namespace record stays prefix and IRI. A namespace IRI is itself in the snapshot, because instances are minted under it (practice-kg/, semantic-foundation/, semantica/, lejeune/ontology/). Kept instance families keep their bytes: the 7 KgNodeKind graph IRIs, the ClaimGate claim base, the semantic-foundation seed concepts and the lab namespaces.
