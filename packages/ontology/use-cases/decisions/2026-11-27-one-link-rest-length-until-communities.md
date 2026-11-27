---
title: Every graph link relaxes toward one 50-unit rest length
date: 2026-11-27
reversal: Split LINK_REST_LENGTH into intra-community (50) and inter-community (150) rest lengths once the projection carries a community per node.
governs:
  - src/aggregates/Session/Session.visualizer.ts#LINK_REST_LENGTH
enforcedBy: []
---

`applySpringForces` pulls every link toward the reference layout's 50-unit intra-community rest length.
Reason: the reference spreads communities apart with a 150-unit rest length on links that cross communities, but this projection carries no per-node community signal, so no link can be classified as crossing one.
Rejected: the reference's 50/150 split. It needs that community signal; take it once the projection carries one.
