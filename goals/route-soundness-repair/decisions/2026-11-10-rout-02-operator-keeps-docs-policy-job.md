---
title: "Operator keeps the D8 docs-policy job for ROUT-02; the Repo Sanity hosting proposal is closed"
date: 2026-11-10
lane: "fix/rout-03-goal-data-census"
pullRequest: 3064
reversal: "A new operator ruling that hosts the knowledge and packet steps in Repo Sanity supersedes this file and amends the docs-only-narrowing decision."
---

Asked on 2026-11-09 where ROUT-02 (knowledge and packet policy on docs-only and goals-only PRs) should run, the operator answered: keep the separate small docs-policy job that D8 ruled. ROUT-02 (PLAN slice 7) therefore builds one check.yml job plus a CiLane id, its setup modeled on the goals-only Repo Sanity path #3039 added (no disk cleanup, no app secrets). The proposed D8 amendment to host those steps inside Repo Sanity, recorded in the 2026-11-10 decision "ROUT-02 is the D8 docs-policy job", is closed without adoption, and slice 7 no longer measures the Repo Sanity alternative before building.
Source: operator answer of 2026-11-09 relayed by the orchestrator session; exploration `explorations/ten-minute-certainty/DECISIONS.md` (D8).
