---
title: "P1 content hashes and revision ids hash the exact node text"
date: 2026-11-10
lane: "agent-memory-store-p1"
reversal: "Introduce a text normalization with normalizationVersion 2 by decision file in P3, citing the S10 dedupe measurement it must reproduce"
---

ContentHash is documented as the SHA-256 of a node's normalized text, but no normalization is defined yet and P1 needs hashes to mint revision ids. contentHashOf hashes the exact UTF-8 bytes of the node text and revisionIdOf hashes the UTF-8 bytes of revisionPreimage, both through the effect/crypto/Digest service (Digest.layerWebCrypto in the live projector). The import anchors record normalizationVersion 1 for this identity normalization. Exact-hash deferral (P3, decision dedupe-exact-defer-near-flag) may define a normalization; it then bumps the version, and revisions minted before keep their ids because a revision id is never recomputed. Code: packages/tooling/library/agent-memory-store/src/NodeIdentity.digest.ts. Rejected: inventing a whitespace normalization in P1 (no measurement behind it).
