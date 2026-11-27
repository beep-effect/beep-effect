---
title: Room measured across a glimpsed area only rescues an area its ordinary plan leaves bare
date: 2026-11-26
reversal: Plan every area from its measured room in plannedFor, or stop building room columns in drawView.
governs:
  - src/internal/shading.ts#MEASURED_ROWS
  - src/internal/shading.ts#roomColumns
  - src/internal/shading.ts#shadeFace
  - src/internal/kernel.ts#drawView
enforcedBy: []
---

An area fewer than `MEASURED_ROWS` probe rows saw gets columns a minimum pitch apart, measured through one more hidden-line pass that runs only when such an area exists.
Reason: a few rows' cells can overstate a pointed glimpse of a face by up to a cell, so a band placed by them lands on the glimpse's empty tip; an area three rows saw is at least a cell tall where its middle row crossed it.
The measured room is a rescue only: an area whose ordinary plan leaves it without a band (a `narrow` or sliver skip, or lines without room) is planned again by that room, each stroke drawn over the area's whole range for the pass to cut to what shows. A band the ordinary plan gives is drawn as it is.
Rejected: planning every area from measured room, which moves bands that already read well.
