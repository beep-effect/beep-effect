---
title: A two-point view takes the 1.84(m) light of its vertical picture plane, not of its tilted sight
date: 2026-11-26
reversal: Derive the light in viewFactsOf from the frame of the camera's sight instead of the frame of its level eye.
governs:
  - src/Shading.rules.ts#viewFactsOf
enforcedBy: []
---

viewFactsOf lights a two-point view from the frame of its level eye, the vertical picture plane, and carries that normal as the view's picture. The tilted sight only frames the sheet.
Reason: a light that leaned with the tilted sight lit one wall parallel to the picture plane at 0.32 from above (light, four lines) and at 0.76 from below (faint, two lines). Lit on the picture plane, the wall takes the square-on exposure 1/√3 and the same band in the two-point top view, the two-point bottom view and the level elevation.
Rejected: lighting from the sight's frame. It looks natural, but it gives one surface two tones across views drawn from the same model.
