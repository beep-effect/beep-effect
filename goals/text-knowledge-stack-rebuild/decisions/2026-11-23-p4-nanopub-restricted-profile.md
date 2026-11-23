---
title: "P4: nanopub is a restricted adapter profile and never imports authority"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Replace the declared profile and golden with a new adapter version while retaining rejected input as residual."
---

@beep/epistemics/rdf/NanopubCodec is the only RDF-dependent claims entry. It exposes encode, decode and normalize over a declared four-named-graph profile: head, assertion, provenance and publication-info. Assertion contains canonical encoded ClaimCore as a typed literal supplied by the caller binding, with its recomputed ClaimId; provenance names generating activity and asserting agent; publication-info carries import/source metadata. The head links the three graphs through nanopublication vocabulary terms. Decoder validates graph separation, exact supported terms, core encoding/hash and matching provenance. Unsupported quads and authority records are residual or typed refusal, never silently dropped. Round-trip is over this declared profile, with quad-set normalization independently defined. Admission and human tokens are never imported as executable authority. Namespace and term registration plus a licensed, digested official-source NamespacePin are prerequisites in the same commit; base entry import-boundary test proves no RDF edge.

Publication identity is separate: NanopubId hashes ClaimId plus canonical publication metadata under nanopub/v1. Five distinct IRIs name publication and graphs. Provenance statements use the assertion graph as subject, and pubinfo uses the nanopublication subject. No Trusty URI or signature compatibility is claimed. The official https://nanopub.net/nschema bytes read during design hash to 1275f6a00121f54248899b9a4c39b2511fdbb65b2925a4dc6f4a13174059f649 and state modified date 2013-10-23, but no license. License attribution for the required NamespacePin remains an explicit implementation blocker for adapter admission; do not invent it.
