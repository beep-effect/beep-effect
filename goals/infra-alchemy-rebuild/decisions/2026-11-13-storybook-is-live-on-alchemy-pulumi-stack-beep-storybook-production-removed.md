---
title: "Storybook is live on Alchemy; Pulumi stack beep-storybook/production removed"
date: 2026-11-13
kind: checkpoint
lane: "goals/infra-alchemy-rebuild-p3-turbo-cache"
reversal: "n/a (status note)"
---

PR #3289 merged 2026-11-13T22:12:56Z as 457e3ae3e8b6. Hosted run 43517423865 (Deploy Storybook, main) planned `2 to create` (Storybook/Build, Storybook), deployed `Done: 2 succeeded` with one Worker route reconciled; its smoke step failed on `iframe=404` one second after the route was created (propagation race, fixed in the turbo-cache PR, which makes both deploy workflows poll their smoke probes for up to 120 seconds). Probed by hand at 22:25Z: the index, the iframe (after its redirect), index.json and the bare slug with a query all return 200 under the public origin's storybook route, an unknown asset returns 404, and the apex still returns 200. `pulumi stack rm production --yes` then removed the empty Pulumi stack (0 resources at removal; the archive's sha256 matched the decision file); `pulumi stack ls` in that project lists no stacks.
