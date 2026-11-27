---
title: The record and grant-set hash labels keep their epistemic- prefix
date: 2026-11-26
reversal: Mint execution-authority labels and verify both prefixes, as the goals decision's reversal describes.
governs:
  - src/entities/ExecutionRecord/ExecutionRecord.model.ts#decisionEncodingVersion
  - src/entities/ExecutionRecord/ExecutionRecord.model.ts#outcomeEncodingVersion
  - src/values/GrantSet/GrantSet.model.ts#grantSetEncodingVersion
enforcedBy: []
---

The version labels prefixed to every record hash and grant-set digest stay `epistemic-*/v1` byte for byte. Records and grant sets began in the epistemic slice, and each label is a hash input: a new label changes every new hash, breaks verification of every stored chain and orphans every persisted `grant_set_digest`. The `/vN` suffix is bumped on any canonical-encoding change, so old and new hashes never collide in a table holding both. Recorded for the slice move in goals/execution-authority-slice/decisions/2026-11-06-hash-domain-labels.md.

Rejected: labels renamed to match the execution-authority slice, which needs a dual-prefix verifier for every stored chain.
