---
title: "This goal assumes the heavy pool at cap 2 and asks for no capacity"
date: 2026-11-09
reversal: "If the operator raises the cap after the post-diet residual, re-run the replay at the new cap and record it as a new decision."
---

Heavy-pool capacity (a cap above 2 or a larger runner class) is money and is decided only against the post-diet heavy-queue residual the certainty scorecard reports. The throughput layout, the replay and re-dispatch all assume cap 2; no slice may raise the cap, change the runner class or depend on either. If the replay shows the layout or re-dispatch cannot fit at cap 2 without regressing PR heavy-wait p95 by more than 1 min, the goal does not land that slice and records the residual as an operator money question. Rejected: sizing the layout against a larger pool (unmeasured, and money).
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D11).
