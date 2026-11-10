---
title: "One hosted lint:shadcn owner in required Repo Sanity makes shadcn findings merge-blocking"
date: 2026-11-09
reversal: "Restore the Shadcn Lint job in check.yml and its lane arm, and remove the lint:shadcn step from Repo Sanity, in one PR."
---

PERIH-02 retires the non-required Shadcn Lint job, runs lint:shadcn inside the required Repo Sanity lane and removes it from the hosted Lint Policy plan (policyStateTasks in Tasks.ts), so exactly one hosted job runs it. Repo Sanity is a required context, so a shadcn finding now blocks merges instead of showing a red non-required check. A unit test asserts exactly one hosted owner of lint:shadcn across check.yml jobs and the hosted Lint Policy plan, so no later dedupe (HOST-03, LINT-05) can leave zero owners. Rejected: keep the Shadcn Lint job and drop the Lint Policy copy (keeps 60 to 70 s of setup per run); drop both copies (//#lint:shadcn is cache:false and runs nowhere else, a proof-depth loss).
Source: `explorations/ten-minute-certainty/research/phase2/PLAN.md` (PERIH-02 row and Cross-area critique, Conflicts).
