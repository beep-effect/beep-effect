---
title: "The lab ruleset is 26917133 with a ten-minute check timeout"
date: 2026-11-10
lane: "docs/merge-queue-lab-findings"
reversal: "Delete ruleset 26917133 (gh api -X DELETE repos/beep-effect/beep-effect/rulesets/26917133)."
---

Created with the operator gh login. It targets refs/heads/queue-lab only, requires queue-lab-gate from GitHub Actions (integration 15368), and carries merge_queue with SQUASH, build concurrency 1, group size 1..1, no wait, ALLGREEN and check_response_timeout_minutes 10 (the design's main settings except the timeout, shortened so hang and no-run probes finish in minutes). No bypass actors. Ruleset 10240248 is unchanged.
