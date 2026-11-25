---
title: "P6: practice-kg-mcp and practice-gateway provide MatterWallLive beside the bundle resources"
date: 2026-11-24
lane: "p6"
reversal: "Remove MatterWallLive from both hosts' layers and drop the requirement from PracticeKgToolkitLayer"
---

PracticeKgToolkitLayer and makePracticeKgServerLayer now require LawPrincipal and MatterAuthority. apps/practice-kg-mcp provides MatterWallLive next to makePracticeKgHostResourcesLayer in makePracticeKgHostServerLayer (src/runtime/Host.ts); apps/practice-gateway loads MatterWallLive with the other Practice KG modules through its dynamic import, so the gateway still starts without the DuckDB sidecar, and provides it in PracticeKgProviderLayer. Both read the principal and grants from the environment; the grants configuration of the operational hosts is the operator's input and part of the row 14 HOLD, and until it exists each host denies every walled path.
