---
title: "Pin @distilled.cloud/vercel at 1.0.0-rc.18"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p2-vercel"
reversal: "Change the root catalog entry and bun.lock in a dedicated pin-bump PR with alchemy plan no-op on every stack (D13)."
---

The root catalog gains `@distilled.cloud/vercel: 1.0.0-rc.18`. It is the published release whose only dependency is `@distilled.cloud/core@1.0.0-rc.18`, the core bun.lock already resolves for the other distilled packages, so no second core version enters the graph. rc.19 and rc.20 exist but would pull a newer core and belong to a deliberate distilled bump (D13). The operation signatures and line numbers the P0 matrix cites (`services/projects.ts`) match rc.18 exactly; every API the package uses was checked against the installed module, not the reference checkout (which tracks rc.19+).
