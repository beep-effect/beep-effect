---
title: "The runner-minutes criterion reads the scorecard's per-head-attempt figure"
date: 2026-11-13
lane: "fix/certainty-scoring-fixes"
pullRequest: 3144
reversal: "Delete this file; the Runner-minutes criterion then reads the scorecard figure under whatever definition it carries when measured."
---

The Runner-minutes acceptance criterion thresholds green code runner-minutes per run (p50 at most 244 against the 264 baseline, p95 reported beside it) "as the scorecard reports it". certainty-scorecard #3144 (decision `certainty-scoring-fixes` there) changed that figure. `greenCodeRunP50` and `greenCodeRunP95` used to come from successful check.yml runs alone, so a head admitted by the `ready-for-heavy` label was scored without the beep-ec2-heavy minutes its heavy-admit.yml run spent. They now cover head attempts: each check.yml run plus the admitted heavy-admit.yml runs of its head, with heavy-admit runs whose Heavy Admission was skipped dropped. On the committed baseline fixture, green code p50/p95 move from 271.63/385.35 to 278.85/385.35, and the per-run mean from 219.7 over 40 runs to 251.08 over 35 head attempts. This goal reads the criterion as runner-minutes per green code head attempt. The 264 and 556 baselines predate the scorecard CLI and are not re-derived here. The cohort this goal is judged on, and any re-measured baseline beside it, must both come from a `beep ci certainty` build that includes #3144, so the baseline and the measurement count the same quantity.
