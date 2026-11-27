---
title: "Criterion 2: build empty-leg runner-minutes and local publish and verify into the certainty report (slice 19)"
date: 2026-11-27
lane: "goals/certainty-scorecard-closeout"
pullRequest: 3617
reversal: "Tick criterion 2 on the separate commands instead (ci ledger, yeet economics --fleet), and drop slice 19 from PLAN.md."
---

Driver ruling 2026-11-27, option (b). The 2026-11-26 nightly (run 46015289067 on 75c299bf25, the first scored by #3609's code) certified and shows every row of SPEC "Numbers the scorecard reports" except two:

- Empty-leg runner-minutes per run (ROUT-01, read by `hosted-setup-tax`). Only `beep ci ledger` computes it (slice 15, decision `ledger-fold-absent-sources`). `report.json` has no field for it.
- Local publish p95 and verify p50 and p95 on the fleet census (read by `local-proof-under-ten`). The report names these figures under "Not covered" with the reason "censored until journal retention lands". That reason is stale, because #3263 shipped retention.

Criterion 2 says each report shows every row. Slice 18 set the precedent (decision `build-the-missing-scorecard-rows-as-slice-18-instead-of-descoping-them`) of building missing rows rather than pointing at other commands or descoping them. Slice 19 therefore builds both rows into `beep ci certainty` and its summary:

- Empty legs. The report joins the MEAS-05 (lane, partition) ledger to the run's `Test Plan` output by reusing the ledger fold's computation, not by copying it.
- Local publish and verify. The row is always present and carries its censoring count. When fleet journals are readable, the figures come from them. In the hosted nightly they are not: the hosted runner cannot read workstation journals, and the source of record is `yeet economics --fleet`, on whose census `local-proof-under-ten` judges its bar. A hosted report therefore shows n=0, every run censored, and that reason. The row is never left out.
- The stale "Not covered" retention reason is replaced.

Until slice 19 merges, criterion 2 stays unticked and the goal is `active`. #3617 becomes an ordinary slice PR: it keeps the evidence for criteria 1 and 3 to 9, the replayInputs ruling and the 2026-11-26 night. The closeout PR follows the first nightly that shows every row, so this packet has at most two open PRs.
