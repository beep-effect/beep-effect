---
title: "P0 confirms RQ5: one packet, one PR or stack per phase, P0 does not split up front"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p0-design"
reversal: "Bootstrap a child packet for any phase that needs more than three open PRs, with a checkpoint naming it in PLAN.md."
---

Confirmed. The census puts the largest single move (the @beep/provenance rename) at 156 consumer files, which is one mechanical PR, and no two phases need to run in parallel because the DAG orders them. The decomposition rule in PLAN.md stands for later phases.
