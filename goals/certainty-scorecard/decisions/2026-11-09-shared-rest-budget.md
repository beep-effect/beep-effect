---
title: "REST budget: the nightly and corpus capture are background readers under github-budget-ledger's reserve"
date: 2026-11-09
reversal: "Supersede once github-budget-ledger changes its reserve signal or a dedicated identity takes these reads; no scorecard-side threshold to remove."
---

The nightly scorecard and the route corpus capture share GitHub read budget with readiness monitors and lane-timings. This goal adds no budget rule of its own: a local run (corpus capture, an ad-hoc certainty or lane-timings census) is a background reader and obeys the 15% per identity x resource reserve signal that `goals/github-budget-ledger` publishes, and records its own request count. The hosted nightly reads with the workflow's GITHUB_TOKEN, re-polls main SHAs only inside the 7-day late-arrival horizon, and checkpoints and resumes instead of certifying a partial read. Rejected: a second threshold defined here (D27: two packets claiming one read path would produce two budgets), and no budgeting (D16: census aborts recur). Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D16 as amended by D27).
