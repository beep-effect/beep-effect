---
title: "Counted: the 15 ruleset contexts on code heads; misses count, mergeable beside, never inside"
date: 2026-11-09
reversal: "Supersede with a decision that widens the context set or pools heads, and recompute every published scorecard under the new rule."
---

The SLO statistic counts only the 15 contexts of ruleset 10240248 (`standards/branch-protection-contexts.json`). Code heads are reported apart from docs heads. Red, held and api-partial heads count as not attained; superseded heads are censored and their runner-minute share is reported; a green-only p95 is a diagnostic, never the target. Time to Yeet-mergeable (Lint Policy, Property Laws, Coverage Regression, Fallow) is reported beside the statistic, never inside it. Rejected: including the mergeable contexts (would make Property Laws sharding and heavy-pool capacity target-critical before cheaper levers land) and green-only pooled heads (gameable by turning slow passes red; pooled docs heads at p95 about 4 min flatter the number). Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D5).
