---
title: "Build the missing scorecard rows as slice 18 instead of descoping them"
date: 2026-11-27
lane: "docs/ci-goals-catchup-11-27"
reversal: "Delete this decision and record a descope decision that moves the rows to their reading goals"
---

The acceptance criterion "every row in 'Numbers the scorecard reports'" is not met in code. No merged slice builds these rows:

- heavy slot-minutes per code run;
- heavy-queue (pickup) p95;
- Lint Policy wall p95;
- Property Laws p95;
- the main run's cancel actor;
- PR first-wave pickup p95 and heavy-wait p95;
- the merge-timestamp replay inputs (hosted jobs per run);
- a 7-day late-arrival horizon for main verdicts.

Three goals read these rows: main-verdict-every-commit holds its slice 2 on them, heavy-pool-diet's P2 measures against them, and part of hosted-setup-tax uses them. Descoping would move one gap into three packets, so slice 18 builds them in `beep ci certainty` and its nightly summary. The certainty-scorecard closeout (slice 17) follows slice 18.
