---
title: "Dedupe defers exact hashes to tier 0 and only flags near-duplicates"
date: 2026-11-09
lane: "goals/agent-memory-store-p0"
reversal: "Re-baseline by decision file citing a new S10 measurement"
---

Confirmed from S10: 73.0% of duplicate writes carried a tier-0 pointer, so exact-hash duplicates defer to the existing node with nothing dropped; simhash at t=2 false-flagged 1.78% (18/1010) while t=4 reached 9.01%, past the kill, so near-duplicates are flagged as typed findings and never merged or dropped. The ContentHash is Sha256Hex over the normalized node text; the near-duplicate flag is advisory for consolidation only.
