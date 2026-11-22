---
title: "P2: authority-identity-cases.json is regenerated in place with a bumped schemaVersion; the oracle equality matrix is unchanged"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Restore the v1 file beside a v2 sibling by a decision file; the v1 bytes are in git at the P2 base."
---

The fixture holds an oracle observation (the 13 by 13 equality matrix and the eyecite inputs) and two derived columns minted by this repository's code: mentionId and expectedId. The scoped amendment says identifiers with no stored rows regenerate their fixtures. P2 rewrites the 13 mentionId inputs from cm1: to cm2: over the same synthetic hex, recomputes the expectedId of the two missing-page cases under citation-authority/v2, bumps schemaVersion to citation-authority-identity-cases/v2 and leaves every other byte, producerSha256 and the matrix included, as captured. The other 11 expectedId values must not change, and CitationAuthorityIdentity.test.ts proves it. A frozen copy beside it would keep 400 lines alive for two derived values; the v1 key derivation is pinned by the migration fixture instead. goals/citation-extraction-engine/history evidence that carries cm1 values is not edited; a dated note in that packet's history records the change.
