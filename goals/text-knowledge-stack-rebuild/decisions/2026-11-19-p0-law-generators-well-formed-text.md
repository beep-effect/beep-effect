---
title: "P0: law-test generators produce well-formed text and valid boundaries; split surrogates are a negative fixture"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p0-design"
pullRequest: 3420
reversal: "Let generators emit lone surrogates and off-boundary ranges, by a decision file before P2 opens; the generator module and ledger row L1-2 are edited in the same change."
---

Law-test generators produce well-formed text only (no lone surrogates) and ranges on valid boundaries, so a generated receipt would also pass re-verification. Split surrogates are a negative fixture for L1-2, not generator noise.
