---
title: "P4: the nanopub profile uses the existing epistemic namespace and rdf:JSON"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Add a dedicated prefix with these terms and deprecate the two epistemic locals through the registry's deprecation records."
---

The profile's own predicates are epistemic:coreJson and epistemic:sourceDigest in the existing epistemic namespace shard, and rdf:JSON is added to the rdf shard, rather than introducing a new epistemics: prefix. The registry writer regenerated the registry data and vocabulary terms.
