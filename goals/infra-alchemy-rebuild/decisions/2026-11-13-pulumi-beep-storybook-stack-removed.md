---
title: "Pulumi stack beep-storybook/production is removed; it held no resources"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p3-storybook"
reversal: "From infra/storybook under AWS_PROFILE=elpresidank-vault: pulumi stack init production, then pulumi stack import --file ~/beep-infra-archives/pulumi-exports/beep-storybook-production-2026-11-13.json."
---

The Pulumi Storybook program was never applied: `pulumi stack ls` in `infra/storybook` (backend `s3://oip-law-pulumi-state`) showed `production` with 0 resources, last updated five months ago. `pulumi stack export --stack production` was archived 2026-11-13 outside the repo at `~/beep-infra-archives/pulumi-exports/beep-storybook-production-2026-11-13.json` (493 bytes, deployment version 3, 0 resources, 0 pending operations, sha256 `fde291a6f1488725c2dd0285b4bd25491578b95deb4d8e9b0823dd33f2448bbf`). `pulumi stack rm production --yes` runs after this decision merges. There is nothing to destroy and nothing to flip. The program sources (`infra/storybook`, `infra/src/Storybook.ts`) leave with the rest of `infra/` in P6; `apps/storybook/vercel.json` is deleted now because no Vercel project reads it.
