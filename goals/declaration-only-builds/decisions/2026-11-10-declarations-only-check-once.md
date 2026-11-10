---
title: "Builds emit declarations only; check once is conditional on census equivalence"
date: 2026-11-10
reversal: "Restore the emit settings and policy values, then regenerate scripts; drop the check-once edge independently if it alone misbehaves."
---

Project references stay. The build emits `.d.ts` and `.d.ts.map` only. 197 of 199 `tsconfig.check.json` files differ from the build config only in emit options, so the first command of `beep:check` repeats the build's type-check. If the check-program census shows identical diagnostics cold, with warm incremental state and after a cache restore, with `TSRS_FAST` unset and `1`, the own-source check is served by the build. Any difference drops that half and the goal ships declarations only. Rejected: leaving JavaScript emit in place, and leaving the double type-check without testing it. Operator ruling.

Source: exploration `explorations/build-pipeline-simplification/DECISIONS.md` (Q7).
