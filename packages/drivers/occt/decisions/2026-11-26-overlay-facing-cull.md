---
title: An overlay line with a facing is drawn only where its face turns toward the camera's sight
date: 2026-11-26
reversal: Return true from facesEye for every overlay.
governs:
  - src/internal/kernel.ts#OVERLAY_MIN_FACING
  - src/internal/kernel.ts#facesEye
  - src/internal/kernel.ts#drawView
enforcedBy: []
---

An overlay line whose facing turns toward the eye by no more than `OVERLAY_MIN_FACING` (a cosine) is never built. The facing is read against the camera's `sight` when it carries one, else against its eye direction.
Reason: a line on a face seen edge-on or from behind would print over an outline; a two-point camera's level eye would turn every level face edge-on, so its sight decides.
Rejected: drawing every overlay and leaving hidden-line removal to hide it, which keeps edge-on lines.
