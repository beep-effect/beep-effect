---
title: "Unblocker #3495 merged over shadowed required contexts"
date: 2026-11-23
lane: "fix/comment-law-property-reporter-header"
pullRequest: 3495
reversal: "None needed: the required contexts had passed; on a repeat, re-apply ready-for-heavy (strict remedy) instead of cancelling the duplicate run"
---

Main's red episode: Repo Sanity's lint:comment-law scope lock on root vitest.property-reporter.ts, a semantic interaction between #3458's four-line header and #3483's root-scope lock (failing Check runs 45082130684 and 45083821617). #3495 (head 010ddbd30726) ran every required Heavy context green in run 45091001258 (Check 137420668103, Docgen 137420668101, Doctest 137420668148). The orchestrator cancelled a duplicate pending Heavy Admit run, 45091017948 (same sha, queued 00:49:31Z), at 01:25Z. That left the required contexts required-shadowed (goals/yeet-async-merge-and-stacks/decisions/2026-11-12-shadowed-heavy-suite.md), and yeet's relaxed merge-async requested a rules bypass. Merged 2026-11-23T01:36:00Z as c936743bb33e. CI driver ruling: a bypass over shadowed contexts, not over reds. Lesson: never cancel a duplicate pending run on a PR with required contexts; let it run, or re-apply ready-for-heavy. The episode closes at the first main Check on c936743b or later with Repo Sanity green.
