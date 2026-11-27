---
title: Keep the production Worker name stable across state moves
date: 2026-11-26
reversal: Remove the explicit production Worker name and let Alchemy generate it from state.
governs:
  - alchemy.run.ts#productionWorkerName
enforcedBy: []
---

Pin the production Worker physical name so a deploy can find it even if Alchemy state moves or is lost.
Reason: generated names depend on an instance id in state; a newly minted name cannot take the route from the live Worker, as the BeepEffectWeb state move demonstrated.
Rejected: generated production names tied only to the current state instance.
