---
title: "computeProfile stays out of every proof digest and reuse key"
date: 2026-11-08
reversal: "Add computeProfile to proofInputKey components and accept that every existing proof key changes"
---

ProofInputDigest, ProofLedgerShadowRow and ProofShadowAttemptFacts record computeProfile as evidence beside envProfile, but proofInputKey still hashes only laneId, commandDigest, envProfile, inputDigest and epochDigest, and ProofLedger key equivalence is unchanged. Existing digests and reuse decisions are untouched; documented on ProofInputKeyComponents.
