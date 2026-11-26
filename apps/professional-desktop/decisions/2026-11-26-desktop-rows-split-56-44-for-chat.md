---
title: The default layout splits the ontology and shell rows 56/44 so Chat stays usable on short viewports
date: 2026-11-26
reversal: Set the desktop-rows topRatio back to 62/38 (6_200).
governs:
  - src/workspace/dock.atoms.ts#defaultDesktopWorkspace
  - src/workspace/dock.atoms.ts#CHAT_MIN
enforcedBy: []
---

The bottom shell row hosts Chat. Its 260px minimum height clamp engages only while the top row's 180px ontology floor, the gap and the 260px bottom row all fit the viewport; below that floor the raw split ratio governs. A 44% bottom share keeps the composer and a few transcript lines visible on short viewports, while the ontology cluster keeps the majority.
Rejected: 62/38, which on short viewports left Chat without a visible composer (QA closeout P0/P1).
