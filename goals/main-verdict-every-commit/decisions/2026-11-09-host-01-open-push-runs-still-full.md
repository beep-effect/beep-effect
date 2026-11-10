---
title: "HOST-01 is open: #3030 left main push runs at full partition allocation"
date: 2026-11-09
reversal: "If a later PR lands any HOST-01 slice, mark that slice landed in SPEC.md with its evidence and keep only the residual."
---

No HOST-01 slice has landed; re-checked at `origin/main` c90929b1ff1. The AGENTS.md Inherited-reds bullet (lines 198 to 202) still tells the orchestrator to cancel runs, running ones included, the main concurrency group is unchanged (`.github/workflows/check.yml` lines 12 to 14), and `rerun-runner-loss.yml` handles failures only. #3030 changed what a pull request allocates, not a push: its Test Plan job publishes every partition on a push (`check.yml:798`), 24 Test Unit (since #3043) and 20 Test Integration partitions (`check.yml:739-740`). The throughput layout therefore changes only the push branch of the Test Plan, and the PR partition tables stay with goals/ci-lane-economics, which owns them.
Source: this goal's lever check, 2026-11-09, repeated at c90929b1ff1 (git show --stat f818c6e52bf and 08972a39a16; goals/ci-lane-economics/SPEC.md, "Not changed").
