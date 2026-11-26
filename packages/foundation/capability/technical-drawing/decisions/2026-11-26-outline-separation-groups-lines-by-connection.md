---
title: Outline separation joins collinear strokes into one line only when they are connected, not because they are level
date: 2026-11-26
reversal: Group the strokes in separateCloseOutlines by their common line alone, or join them only across a narrow break.
governs:
  - src/Outline.rules.ts#separateCloseOutlines
enforcedBy: []
---

separateCloseOutlines moves collinear strokes as one line when they overlap, when they are parted by no more than a break, or when a line crossing at 10° or more cuts each end that faces the gap (a part in front, however wide). A degenerate point at a facing end crosses nothing and joins nothing.
Reason: grouping by a common level alone moved a distant box top together with the one a close line ran beside. Joining only across a narrow break sent the two pieces of an edge seen either side of a wide post in opposite directions, so the edge jogged across the post.
Rejected: grouping by common level, which moves edges that have no close neighbour. Joining only across a narrow break splits one edge seen either side of a part in front.
