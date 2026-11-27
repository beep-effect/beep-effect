---
title: Ink-order neighbours are faces of one solid that share an edge the view shows
date: 2026-11-26
reversal: Pair every two seen faces that share an edge in visibleNeighbours, whatever the view shows of it.
governs:
  - src/internal/kernel.ts#visibleNeighbours
enforcedBy: []
---

Two faces are neighbours when both bound one edge topologically (found by hash, confirmed with `isSame`) and the view shows at least `least` of it on the view plane, summed over every such edge of the pair: the share of its samples within `tolerance` of the drawn outline times its projected length. Only faces the probes saw are paired.
Reason: a lighter face's band must not out-ink a darker face beside it on the sheet, and only a shared edge the reader sees puts them side by side.
Faces of separate parts never share an edge, so parts that merely meet are not neighbours.
Rejected: pairing on topology alone, which orders faces whose shared edge is hidden.
Accepted limit: the test reads the sheet alone, so a drawn edge of a part in front that projects exactly onto a hidden shared edge (a post's corner on the sight line through a ridge) passes for that edge.
