---
title: "Re-pin @distilled.cloud/vercel at 1.0.0-rc.19 after main moved to core rc.19"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p2-vercel"
pullRequest: 3290
reversal: "Return the catalog entry to the vercel release that matches whatever @distilled.cloud/core main resolves, in the same PR as that core bump."
---

Supersedes the rc.18 pin decision. #3278 (93fe11eb05) moved main to `alchemy`/`@alchemy.run/*` 2.0.0-beta.86 and `@distilled.cloud/core@1.0.0-rc.19`. Keeping vercel at rc.18 would bring core rc.18 back as a second version, so the catalog entry moves to `@distilled.cloud/vercel@1.0.0-rc.19`, whose only dependency is core rc.19. `bun.lock` was regenerated from main's copy with `bun install`; it resolves a single core (rc.19). Against the installed rc.19 and beta.86, the package type checks and its 17 tests pass. The one adaptation is in the test harness: beta.86 types provider lifecycle errors as `ProviderError`.
