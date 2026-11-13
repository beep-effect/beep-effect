---
title: "PartyKey v1 keeps its serializer and gains a parity proof"
date: 2026-11-13
lane: "refactor/canonical-digest-owner-swaps"
reversal: "Delete the parity block from the PartyKey test and the devDependency; the pinned fixture still fixes the bytes."
---

PartyKey v1 bytes are pinned by the archived party-slice specification and by the package fixture, and SPEC.md forbids changing them, so its encoder is not swapped. A property in the package's PartyKey test holds its canonicalJson equal to the owner's RFC 8785 bytes for the encoded basis on 200 seeded bases (source-record and namespaced identifier, drawn from canonical text), and hand-written cases cover each escape it writes and the pinned email basis. The two agree because the basis domain is narrow: fixed ASCII keys, where code-point and UTF-16 order coincide, string values only, and unpaired surrogates refused at decode. The census row stays pinned with the proof as its evidence. Adds @beep/jsonc as a devDependency of @beep/party-domain. Rejected: a swap, which would make the owner's future behaviour part of a pinned contract, and a pinned row without proof, which would leave the slice D guard trusting an unverified claim.
