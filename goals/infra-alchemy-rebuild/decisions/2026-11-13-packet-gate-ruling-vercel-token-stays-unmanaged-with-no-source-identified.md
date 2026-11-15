---
title: "Packet gate ruling: VERCEL_TOKEN stays unmanaged with no source identified"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p3-github"
reversal: "A later decision identifies the token's 1Password field and manages it."
---

Ruling by the packet gate session, 2026-11-13: `VERCEL_TOKEN` stays unmanaged, and its source between `CLOUD_VERCEL_TOKEN` and `CLOUD_VERCEL_API_TOKEN` need not be identified now. Arming stays off until the gate says so: it needs the App, the reviewer-switch change merged, and the orchestrator told first, because the stack rewrites the ruleset that gates every merge during a CI measurement window.
