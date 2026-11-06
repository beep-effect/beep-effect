---
title: "HANDOFF render never drops hand-typed register or ruling rows"
date: 2026-11-06
lane: "feat/orchestrator-handoff-p2"
reversal: "Remove carriedOver/withCarry from Handoff.ts; regenerated sections then replace the prior body wholesale."
---

The P3 drill rendered the live HANDOFF.md and the first render would have replaced its hand-typed Register table (claude-session and systemd timer rows the register file never held) and, once the rulings store had one ruling, the whole hand-typed rulings table. A regenerated Register or Rulings section now appends any prior body that did not come from its store, or the block an earlier render carried, under a 'Carried over' heading; it persists until the holder records each item and deletes it. The preamble also keeps a `Holder thread:` line (the drill found no route to ask the live holder for release) and one 'Rendered by `session handoff`' line naming when the carried-over prose was last written, because a successor could not tell fresh prose from three-day-old prose.
