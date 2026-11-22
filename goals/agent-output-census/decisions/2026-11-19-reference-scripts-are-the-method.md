---
title: "The surviving audit scripts are the method reference, and their rules move into the class domain unchanged"
date: 2026-11-19
lane: "goals/agent-output-census-library"
reversal: "Rewrite the class rules from the audit's prose and re-attribute every row that moves."
---

The scripts that produced the 2026-11-18 tables survive in the authoring session's scratch directory: a first pass that attributes tool results, carried cost and the calibration samples; a second pass that classifies turns; and a pass over the captured verification output that measures filter habits and line classes. They are not tracked and are not copied into the repository. The census ports their behaviour: the first-match command rules, the filter rule, the verification set, the turn rules, the shell-prefix stripping used for re-run detection, the redirect-target extraction used for log digs, and the line-class rules, all under the rule version census-rules/2026-11-18. The full-precision numbers that run wrote (calls, token totals, 127 sessions, 96 subagents, 32 Codex sessions, 9,038 calibration samples) are the comparison target in P4 beside the audit's rounded tables. Where the audit's prose and the scripts differ, the scripts win, because they made the numbers.
