---
title: "Slice 3: the heavy lanes have not run on #3302; they run when the hold lifts"
date: 2026-11-14
kind: checkpoint
lane: "perf/heavy-pool-diet-lanes-first"
pullRequest: 3302
reversal: "Apply ready-for-heavy by hand before the hold lifts if the driver wants the heavy proof early; each later push then re-runs the five lanes."
---

Read on 2026-11-14: #3302 never received the ready-for-heavy label (it was marked ready through the shared login, not by yeet ready), so on its heads 783685b532, 9273a1dffc and 49c2ace7d5 the Heavy call was skipped and Heavy / Check, Lint Policy, Docgen, Doctest and Build did not run. Its other hosted checks pass, and workflow-lint, the cache audit and the quick package verify pass locally. yeet ready applies the label only when every review thread is answered, and the driver's window-5-hold thread must stay unresolved, so the label is not applied by hand around it. Before any final on #3302: resolve of the hold by the driver, yeet ready, a green run of the five heavy lanes, then the final. The same gap let #3311 merge without its heavy lanes, which put the ep101 check errors on main. Slices 6 and 9 are stacked on this branch and inherit the rule.
