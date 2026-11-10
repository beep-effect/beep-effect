---
title: "The full canonical corpus replay stays on every push and every code PR that selects its owners; no lever here may shrink it"
date: 2026-11-09
reversal: "Only a new exploration ruling after main verdicts reach at least 95% (D7) may move the replay to smoke-per-PR plus full on main; this goal would then record the change as a new decision."
---

Test Integration replays the full canonical citation corpus (no smoke or sampled subset) at the real 30 s extractDeadline on every push and on every code PR whose selection includes its owners, and it is the only production-deadline witness. No lever in this goal (empty-leg skips under ROUT-01, lane-relevance skips under PERIH-04, setup removals) may drop, sample or narrow that replay: a partition that carries a replay test is always planned when its owners are selected, and int-rest is always planned. Rejected: smoke per PR plus full on main or nightly (with a 13% main verdict rate a deadline regression could reach main undetected). TEST-03 stays dropped.
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D9).
