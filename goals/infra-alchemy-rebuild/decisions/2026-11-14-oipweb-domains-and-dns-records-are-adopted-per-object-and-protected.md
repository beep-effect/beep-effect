---
title: "OipWeb domains and DNS records are adopted per object and protected"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p4-oip-web"
reversal: "Remove adopt(true) and RemovalPolicy.protect from the Domain and DNS declarations and delete-then-create each record during a maintenance window instead."
---

Per D20 the six Vercel domains (`oip.law`, `www.oip.law`, `opip.law`, `www.opip.law` on prod; `staging.oip.law`, `staging.opip.law` on staging) and the six Cloudflare records Pulumi owns (ids matching state) are adopted with `adopt(true)`. With the project adopted in place the domains are already on the target project, so `moveFrom` is not needed. Redirect codes are kept (308 on prod, 307 on staging). Records keep content, `proxied: false` and automatic TTL; only the comment changes to name the Alchemy stack, an in-place update. Both carry `RemovalPolicy.protect()` on live stages, and the workflow's plan guard refuses any replace, delete or orphan of either.
