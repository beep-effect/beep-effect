---
title: "Targeted narrowing of the #2999 docs-only widening, a docs-policy job, rollback by 2026-11-16"
date: 2026-11-09
reversal: "Restore the pre-#2999 docs regex in CiOperational.schemas.ts, regenerate the patterns projection and delete the docs-policy job."
---

The #2999 widening that made every file in a goal packet docs-only is narrowed, not rolled back: a generated census of every `goals/` path a test reads, spawns or imports, or that a `turbo.json` declares, keeps those paths on the code route (ROUT-03), and a small hosted docs-policy job runs knowledge and packet policy on docs-only and goals-only PRs (ROUT-02). If the ROUT-03 census PR cannot land within a week of the 2026-11-09 ruling, that is by 2026-11-16, the docs regex is rolled back in full to its pre-#2999 form. Rejected: full rollback now (loses the docs-only savings on every packet PR) and keeping the widening as is (nothing can be admitted on top of an unsound selector).
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D8).
