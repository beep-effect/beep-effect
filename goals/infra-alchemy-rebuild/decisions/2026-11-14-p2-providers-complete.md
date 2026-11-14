---
title: "P2 Providers complete"
date: 2026-11-14
kind: checkpoint
lane: "goals/infra-alchemy-rebuild-p2-github-runners-composite"
reversal: "Set P2 back to in-progress in ops/manifest.json, PLAN.md and README.md and delete this checkpoint."
---

P2 Providers closed 2026-11-14 with all three provider packages on `main` or in their last PR: `@beep/alchemy-aws-extras` (#3292), `@beep/alchemy-vercel` (#3290) and `@beep/alchemy-github-runners` (#3291 for the Lambdas, plus #3314 for `RunnerFleet`, `RunnerSweep` and the runner user data, composing `RunnerLaunchTemplate` from aws-extras). Each passes `package-verify` with hermetic provider tests covering create, update, delete, read and adopt; nothing was deployed and no workflow changed. P3 status is left as `main` records it.
