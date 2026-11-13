---
title: "Certainty nightly is live; first run recorded"
date: 2026-11-13
kind: checkpoint
lane: "docs/certainty-nightly-first-run"
reversal: "Delete this checkpoint and the 2026-11-12 row; they record a measurement and change no behaviour."
---

The workflow from slice 4 (#3266) is on main. Its first run, dispatched for 2026-11-12, certified: run 43433123124, attempt 1, 84 GitHub requests, 2m43s of job time (3 billed minutes), 43 heads judged. Readings for that day: push to every required green over 32 code heads has 14 misses and a p50 of 23.3 minutes with p95 not attained; green-only code heads p50 15.8 and p95 27.9 minutes; main verdict rate 47.1% (8 of 17 non-docs commits, 9 cancelled); runner-minutes per green code head attempt p50 108.7. The row and the aggregates-only summary are under `history/`. This day is before the first countable day (2026-11-14), so P2 has zero of seven nights. Slices on main: 1, 2, 3, 4, 5, 6, 10, 11; in review: 7 (#3263).
