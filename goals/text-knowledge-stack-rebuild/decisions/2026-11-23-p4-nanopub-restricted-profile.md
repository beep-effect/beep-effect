---
title: "P4: nanopub is a restricted adapter profile and never imports authority"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Replace the declared profile and golden with a new adapter version while retaining rejected input as residual."
---

@beep/epistemics/rdf/NanopubCodec is the only RDF-dependent claims entry. It exposes encode, decode and normalize over a declared four-named-graph profile: head, assertion, provenance and publication-info. Assertion contains canonical encoded ClaimCore as a typed literal supplied by the caller binding, with its recomputed ClaimId; provenance names generating activity and asserting agent; publication-info carries import/source metadata. The head links the three graphs through nanopublication vocabulary terms. Decoder validates graph separation, exact supported terms, core encoding/hash and matching provenance. Unsupported quads and authority records are residual or typed refusal, never silently dropped. Round-trip is over this declared profile, with quad-set normalization independently defined. Admission and human tokens are never imported as executable authority. Namespace and term registration plus a licensed, digested official-source NamespacePin are prerequisites in the same commit; base entry import-boundary test proves no RDF edge.

Publication identity is separate: NanopubId hashes ClaimId plus canonical publication metadata under nanopub/v1. Five distinct IRIs name publication and graphs. Provenance statements use the assertion graph as subject, and pubinfo uses the nanopublication subject. No Trusty URI or signature compatibility is claimed. The official https://nanopub.net/nschema bytes read during design hash to 1275f6a00121f54248899b9a4c39b2511fdbb65b2925a4dc6f4a13174059f649 and state modified date 2013-10-23, but no license. License attribution for the required NamespacePin remains an explicit implementation blocker for adapter admission; do not invent it.

Independent review correction: apply p4-nanopub-decode-publication-integrity. Recompute publication identity and check all five derived IRIs on decode; normalization never repairs failed integrity.

Reviewer-provided pinned source provenance (recorded here without a new GitHub access):

- [Website deployment workflow](https://github.com/Nanopublication/nanopub-website/blob/b6f41631a89791611f69ce5f7ffc63ad56e4fa08/.github/workflows/deploy.yml) copies Guidelines/nschema.ttl to /nschema.
- [Pinned TTL](https://github.com/Nanopublication/Guidelines/blob/8388dd90795b264f4b01c64d0f7218babcae4871/nschema.ttl) and served https://nanopub.net/nschema have SHA-256 1275f6a00121f54248899b9a4c39b2511fdbb65b2925a4dc6f4a13174059f649. The TTL has no license notice.
- [Companion HTML](https://github.com/Nanopublication/Guidelines/blob/8388dd90795b264f4b01c64d0f7218babcae4871/nschema.html), around line 137, grants Creative Commons ShareAlike Attribution 3.0 for "this document", linked as http://creativecommons.org/licenses/sa-by/3.0/.

The HTML notice does not explicitly cover the TTL. The website repository MIT license does not cover imported TTL bytes. Keep the exact TTL unlicensed/unresolved in the design and hold NamespacePin registration and adapter admission until attributable permission is established; neither source provenance nor the companion notice releases that hold.
