---
title: "Storybook deploys as a Cloudflare StaticSite, not through the Vercel provider"
date: 2026-11-09
lane: "goals/infra-alchemy-rebuild-p1"
reversal: "Replace the StaticSite in apps/storybook/alchemy.run.ts with Vercel.Project/Domain from @beep/alchemy-vercel once that library exists; no live resource depends on the choice."
---

Open question 8 of the P0 matrix. Storybook deploys through `Cloudflare.Website.StaticSite` in `apps/storybook/alchemy.run.ts`, not through `@beep/alchemy-vercel`. The Pulumi Storybook program was never applied, so nothing is live to flip; StaticSite needs no new provider and no Vercel seat, and it matches `apps/beep-effect-web` (the one live stack, also Cloudflare). D3 scoped the Vercel resources to OIP, "and Storybook if it stays on Vercel"; it does not. `@beep/alchemy-vercel` stays exactly the three OIP resources.
