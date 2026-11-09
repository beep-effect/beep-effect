---
title: "BeepEffectWeb re-adopts into the shared store by name, adopt only on dispatch"
date: 2026-11-09
lane: "goals/infra-alchemy-rebuild-p1"
reversal: "Set state back to Cloudflare.state() in apps/beep-effect-web/alchemy.run.ts and drop the AWS credentials step; the Cloudflare store still holds the previous prod state."
---

`BeepEffectWeb` moves from `Cloudflare.state()` to the shared S3 store by code change only (`apps/beep-effect-web/alchemy.run.ts`): Alchemy has no Cloudflare-to-AWS state migration, so the first `prod` deploy against the empty S3 stage reads every resource by name. `Cloudflare.Worker` (custom domain and redirects included) reports plain attributes, so it adopts silently; nothing in the stack is `Unowned`. The deploy workflow gains a `workflow_dispatch` input `adopt` that passes `--adopt` for the one case a read reports `Unowned`; it is never set on push. The old state objects stay in the Cloudflare Durable Object store untouched and are deleted only after the S3 plan shows no create or replace. Acceptance per the P0 note: plan shows no create or replace, `alchemy drift` clean.
