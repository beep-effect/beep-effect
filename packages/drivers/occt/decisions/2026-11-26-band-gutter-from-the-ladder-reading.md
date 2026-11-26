---
title: A band's gutter comes from the kernel's reading of the drawn lines beyond its edge
date: 2026-11-26
reversal: Return O.none() from groupBeyondOf so no band is planned behind a gutter.
governs:
  - src/internal/kernel.ts#LADDER_REACH_PITCHES
  - src/internal/kernel.ts#groupBeyondOf
  - src/internal/kernel.ts#drawnBack
  - src/internal/kernel.ts#drawView
  - src/internal/shading.ts#shadeFace
enforcedBy: []
---

Each planned stroke of a band's first line and the band's edge are projected onto the view plane, and `ladderPitch` reads the spacing to the nearest drawn line within the ladder reach running alongside the edge beyond the band; the least spacing over the line's strokes is the band's. Without a ladder reach on the plan the reach is five thirds of the minimum pitch (2.5 mm at a 1.5 mm pitch, the validator's reach).
The stroke is read as the legibility pass draws it, a pitch shorter at each end, against every line the sheet draws (outlines and the overlays, which also go through the probe pass), so the kernel reads what the validator's ladder check reads.
Reason: band, edge and lines just beyond (a wall's two lines past a flap's free edge) otherwise read as one evenly spaced ladder.
A gutter moves a band but never empties it: where the band behind it turns `narrow` or a sliver, or loses the room the plain band has, it stays where its edge puts it. The first line read is the one the rules placed, also when they moved the band inward off a glimpsed tip.
Rejected: planning bands without reading the sheet beyond their edge.
