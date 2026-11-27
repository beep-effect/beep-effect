---
title: A negotiating client reads the protocol generation from the initialize reply's shape, not its protocolVersion
date: 2026-11-26
reversal: Set the generation from response.protocolVersion in recordGeneration.
governs:
  - src/AcpClient.service.ts#recordGeneration
enforcedBy: []
---

`recordGeneration` picks generation 2 only when the reply decodes as a generation-2 `InitializeResponse`; a pinned client keeps its generation.
Reason: some agents report `protocolVersion: 2` with the generation-1 reply shape, and the generation decides which methods every later call uses.
Rejected: trusting `protocolVersion`.
