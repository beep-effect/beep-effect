---
title: "Heartbeat and block-until-changed carried from core-enhancements"
date: 2026-11-18
lane: "explore/agent-verification-output"
reversal: "Drop the heartbeat and the block-until-changed mode and restore the polled status output"
---

The operator selected all four enhancements in `explorations/agent-verification-output/DECISIONS.md`, entry `core-enhancements`. This goal carries three of them. The heartbeat: a gate that outlives a threshold prints one progress line at a fixed interval, naming the step, elapsed time and time since last activity. Block until changed: the gate table, `job wait` and the readiness monitor gain a mode that returns only when state changes and prints only the changed rows. Cause folding extended: the cascade table core starts with grows lint and build cascades where a code-keyed cascade is known. The fix-loop delta is carried by `goals/gate-run-history`. Each removes a measured cost in the census: kill-and-rerun on gates that look hung, and gate-table rows re-polled every four minutes (about 6% of Yeet output).
