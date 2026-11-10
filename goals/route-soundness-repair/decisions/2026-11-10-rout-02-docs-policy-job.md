---
title: "ROUT-02 is the D8 docs-policy job; Repo Sanity hosting is a proposed D8 amendment"
date: 2026-11-10
reversal: "If the operator accepts the amendment, supersede this decision with one that hosts the knowledge and packet steps in Repo Sanity and amend the docs-only-narrowing decision."
---

ROUT-02 builds the small hosted docs-policy job D8 rules: one check.yml job plus a CiLane id, its setup modeled on the goals-only Repo Sanity path #3039 added (no disk cleanup, no app secrets). Hosting the knowledge and packet steps inside Repo Sanity instead is recorded only as a proposed amendment to D8 for the operator, because an agent decision cannot change the form an operator ruling chose. The trade: Repo Sanity hosting adds no hosted job against the concurrent-job ceiling, but folds knowledge and packet policy into an existing required context and lengthens it on documentation heads. The slice measures both before building.
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D8); `.github/workflows/check.yml` at c90929b1ff1 and #3039.
