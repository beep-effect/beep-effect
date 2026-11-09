---
title: "Node identity depends on @beep/provenance now and follows the @beep/text rename"
date: 2026-11-09
lane: "goals/agent-memory-store-p0"
reversal: "Pin the store to its own anchor schema by decision file only if text-knowledge-stack-rebuild abandons the occurrence preimage"
---

The entry's starting position is confirmed: the store mints its own NodeId at admission and RevisionId = hash(NodeId, parents, ContentHash) with Sha256Hex from @beep/schema; span anchoring in the Markdown projection is the occurrence preimage (SourceTextIdentity with extractor pins, unit, range, quote) imported from @beep/provenance, which text-knowledge-stack-rebuild P2 renames to @beep/text and migrates every consumer in that PR. Identity tiers (exact hash, SCIP symbol, fused text) are bounded in P3 from S2, S9 and S10. Rejected: waiting for @beep/text (puts P1 on another packet's schedule) and a store-local anchor (forks span identity, forbidden by the SPEC constraint).
