---
title: "The CI projection is the third view of the same gate report"
date: 2026-11-18
lane: "explore/agent-verification-output"
reversal: "Leave hosted jobs on raw tool streams and Turbo step summaries"
---

Operator ruling in `explorations/agent-verification-output/DECISIONS.md`, entry `audience-three-projections`: one record, three projections chosen by detection with a flag to override. This goal builds the CI one: a GitHub job summary plus a grouped log, rendered from the gate report and never from the job log. A hosted red therefore reads the same facts in the same order as the local agent console, so a human checking a hosted job sees what an agent saw. GitHub limits (annotations per step and per job, summary size, summaries per job) are laws of the renderer.
