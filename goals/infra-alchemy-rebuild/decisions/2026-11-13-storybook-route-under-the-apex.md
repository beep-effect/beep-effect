---
title: "Storybook is served at beep-effect.com/storybook through zone routes"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p3-storybook"
reversal: "Remove the routes from apps/storybook/alchemy.run.ts and give the Worker a domain (or workers.dev) instead; alchemy destroy --stage prod removes the Worker and both routes."
---

The `Storybook` stack (`apps/storybook/alchemy.run.ts`) is a `Cloudflare.Website.StaticSite` whose `prod` Worker has no custom domain and no workers.dev URL: two zone routes, `beep-effect.com/storybook` and `beep-effect.com/storybook/*`, put it in front of the apex Worker. The 2026-10-20 public-origin ruling makes `beep-effect.com` the single origin and reserves the `storybook` slug in `@beep/public-site` (`SiteRoute`), so a subdomain would contradict the route map. The build writes to `site/storybook`, so every asset path already carries the route prefix and the Worker needs no script. The prod Worker name is pinned (`beep-storybook-prod`) because a generated name comes from a state-held instance id (the #3133 lesson). `memo: false`: stories live in sibling workspace packages outside the default memo scope, so the build runs on each deploy and the Worker changes only when the output does. Proof before prod: stage `dev_elpresidank` deployed 2026-11-13 (568 assets); `/storybook` redirects to `/storybook/`, `/storybook/` and `/storybook/index.json` return 200, `/storybook/iframe.html?…` redirects to `/storybook/iframe?…` with the query intact, an unknown asset and `/` return 404. The stage was destroyed afterwards.
