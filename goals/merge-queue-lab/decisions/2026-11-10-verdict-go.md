---
title: "Verdict: go"
date: 2026-11-10
lane: "docs/merge-queue-lab-findings"
reversal: "Supersede with a park or kill decision and flip explorations/github-merge-queue's status with the reason."
---

Every identity the fleet merges with can enqueue (the App, the fleet fine-grained PAT and the operator login; the App also jumps and enqueues workflow-touching pull requests). The lab ran in this repository on ruleset 26917133. No finding contradicts an exploration ruling: the landed commit is the group's head commit, and pause, jump and resume work, with pause and resume needing a ruleset write the App lacks. Findings and the constraints carried to the gated candidates are in research/findings.md. The four gated candidates keep their gates; queue-lab and its ruleset stay with build concurrency 0.
