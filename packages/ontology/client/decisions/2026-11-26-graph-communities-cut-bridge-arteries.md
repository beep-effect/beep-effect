---
title: Graph communities are one-shot Girvan-Newman cuts on the betweenness channel
date: 2026-11-26
reversal: Replace graphCommunities with label propagation over buildGraphAdjacency.
governs:
  - src/aggregates/Session/Session.atoms.ts#graphCommunities
  - src/aggregates/Session/Session.atoms.ts#communityArteryThreshold
  - src/aggregates/Session/Session.atoms.ts#includesCommunityEdge
enforcedBy: []
---

`graphCommunities` drops every artery edge and colors the connected components that remain. An edge is an artery when the smaller of its two endpoint betweenness scores, normalized, is above `communityArteryThreshold` (0.4, tuned on product graphs). It reuses the betweenness channel the 3D renderer already computes and is deterministic.
Taking the minimum cuts only hub-to-hub edges: a leaf scores about 0, so hub-to-leaf star edges survive while the arteries between clusters are removed.
Rejected: label propagation. Synchronous updates two-color the tree-heavy ontology graphs and asynchronous updates flood through bridge nodes.
