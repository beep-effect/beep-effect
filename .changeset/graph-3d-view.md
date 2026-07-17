---
"@beep/graph-3d": minor
"@beep/identity": patch
"@beep/ontology-use-cases": minor
"@beep/ontology-client": minor
"@beep/ontology-ui": patch
---

InfraNodus-style 3D knowledge-graph view (goal graph-3d-view): new
`@beep/graph-3d` instanced three.js render driver (community-colored billboard
nodes, importance-proportional distance-faded canvas-sprite labels, curved
ribbon edges, selection dimming, `/browser` subpath) with Storybook stories,
FPS probe, and a `@vitest/browser` lifecycle suite; ontology visualizer worker
bakes force-relaxed 3D depths into a new `pointDepths` projection buffer;
ontology client maps projections to the 3D driver (Brandes betweenness,
deterministic label-propagation communities) behind a workbench 2D/3D renderer
toggle with cosmos remaining the default.
