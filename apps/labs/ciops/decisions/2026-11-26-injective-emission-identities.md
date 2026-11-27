---
title: Escape punctuation in provisional node identities
date: 2026-11-26
reversal: Replace bytewise PN_LOCAL encoding with encodeURIComponent and regenerate the emission fixtures.
governs:
  - src/projection/Turtle.ts#pnLocalSlug
  - src/projection/Turtle.ts#serializeProposal
enforcedBy: []
---

Keep ASCII alphanumerics verbatim and escape every other UTF-8 byte as a percent-HH PLX sequence when minting provisional nodes.
Reason: distinct ids must mint distinct nodes, and id text must not forge the structural -step- or -request- suffixes. Escaping hyphens inside every specification component also makes the hyphen-delimited identity tuple injective.
Rejected: encodeURIComponent or raw PN_LOCAL text, which leaves hyphens available to impersonate structural separators.
