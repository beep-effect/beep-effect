---
title: "P3 Low-risk stacks complete"
date: 2026-11-23
kind: checkpoint
lane: "docs/infra-alchemy-p3-close"
reversal: "Set P3 back to in-progress in ops/manifest.json, PLAN.md and README.md and delete this checkpoint."
---

All four P3 stacks are live on Alchemy, and none has a live Pulumi program.

- **Storybook:** live since #3289 (2026-11-13); Pulumi stack `beep-storybook/production` removed (`decisions/2026-11-13-storybook-is-live-on-alchemy-pulumi-stack-beep-storybook-production-removed.md`).
- **Turbo cache:** `@beep/infra-turbo-cache` serves CI. Stage 2 moved every Turbo-backed workflow to the Worker cache (`decisions/2026-11-18-turbo-cache-stage-2-every-turbo-backed-ci-job-reads-the-worker-cache-under-new-names.md`), and the follow-on chain (#3380, #3385, #3389, #3390) brought the schedule and dispatch callers along. Hit evidence: main Check run 45225209782 at `3a5d25a64b7c`, job Heavy / Docgen 137885914937, `TURBO_API` the Worker, `Cached: 197 cached, 200 total`. The Pulumi lab stack `lab-c1023a` was destroyed on 2026-10-24 and never held live state (`decisions/2026-11-14-turbo-cache-lab-lab-c1023a-was-destroyed-on-2026-10-24-nothing-is-live.md`).
- **Cost controls:** live since #3320; the old pair was destroyed and 11 state entries removed, with the BEFORE export archived by sha256 (`decisions/2026-11-14-cost-controls-pulumi-cutover-executed.md`).
- **GitHub:** `@beep/infra-github` is armed and has deployed since 2026-11-18 (`decisions/2026-11-18-infra-github-is-armed-beep-infra-github-app-5808968-first-deploy-adopted-ruleset-10240248-with-no-write.md`). Its latest deploy, run 45253869434 after #3510, created exactly the `fleet-watch` environment and its variable. GitHub never had a Pulumi program.

The exit criterion's four Pulumi programs therefore resolve to two destroyed with export archives (Storybook, cost controls), one lab stack destroyed before this packet, and one that never existed (GitHub).
