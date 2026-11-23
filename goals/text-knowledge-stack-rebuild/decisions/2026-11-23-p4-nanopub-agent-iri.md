---
title: "P4: prov:wasAttributedTo names the asserting agent by a nanopub-agent/v1 hash"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Bump the preimage to nanopub-agent/v2, or take an agent-IRI port from the caller binding."
---

The provenance graph names the agent by the hash of its encoded assertedBy under a new nanopub-agent/v1 preimage with a committed golden, so one agent always gets one IRI and decode rechecks it against the decoded core.
