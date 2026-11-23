---
title: "P2: the cache-baseline request names @beep/provenance in previous only, not among its subjects"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Add @beep/provenance to the request's subjects once beep cache baseline accepts a subject that left the task graph, and re-record."
---

Section 3.1 of research/2026-11-20-p2-design.md says the request's subjects name every changed subject, @beep/provenance included. bun run beep cache baseline refuses that request: the retired package is no longer in the task graph, and the command reports it as an unknown subject. The request docs/reports/tksr-p2-l1-move-cache-baseline-request-2026-11-22.json therefore lists the 22 subjects in the graph (the root, 20 consumers and @beep/text) and keeps the retired file's digest in previous. The command then drops standards/cache-baseline/@beep/provenance.json as a subject that left the graph (printed as Dropped), so no baseline file is deleted by hand, which is what the design asked for. bun run beep cache audit and bun run beep quality cache-policy read 0 blocking findings afterwards.
