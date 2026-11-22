---
title: "The window is 10 runs, the read deadline 250 ms, and open contention retries 5 times from 50 ms"
date: 2026-11-20
lane: "goals/gate-run-history-lane"
reversal: "Change the defaults in the history configuration schema; they are configuration, not constants."
---

The window W is 10 observations per series per branch, for the reader and for retention alike. Runs are kept newest 200 per gate, subject and branch. The label and delta read runs under core's existing deadline constant, 250 ms. A busy open or a contended migration retries on a jittered exponential schedule, 5 attempts from 50 ms. These are the spec's values; nothing in the upstream sources or the driver argues for others.
