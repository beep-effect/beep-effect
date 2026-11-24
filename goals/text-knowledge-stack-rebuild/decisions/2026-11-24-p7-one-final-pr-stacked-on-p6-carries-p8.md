---
title: "P7: the cut-over ships as one PR stacked on P6, and P8 drives that same PR as the packet's final PR"
date: 2026-11-24
lane: "p7"
reversal: "Open P8 as its own docs-only PR stacked on the P7 branch, carrying the closeout record, the amendment expiry and the reflection, and merge it last"
---

PLAN.md says each of P1 to P7 is its own PR or PR stack and that P8 names the last of them. P8's goal is to publish the final PR through Yeet, run `bun run beep yeet final-check` on its pushed head, drive it to mergeable and put the `closeout` record and the reflection on board. P8 has no code surface. P7 is the top layer of the P4 to P7 stack, so its PR merges last and is the final PR that the closeout names.

A separate P8 PR would hold only the closeout commit, the amendment expiry and the reflection. It would be a fourth open PR in a stack whose packet limit is three (operator 2026-11-05), and between the two merges P7 would sit on `origin/main` with no closeout, which `goals doctor --online` and `yeet sweep --retire` report. So the P7 PR carries rows 0 to 7 of the P7 design (`research/2026-11-24-p7-design.md` section 11) and the P8 rows 8 and 9. The P7 lane opens it at content-final once the packet has fewer than three open PRs, and runs `bun run beep goals set-status text-knowledge-stack-rebuild completed-retained` after it is open, so the closeout names it.

The lane merges the P6 head after each parent layer merges (the stack's base-merge rule) and re-runs both delete-package dry runs on the merged head before rows 1 and 3. P7 changes no registry term, so it does not rewrite the term snapshot. Closure inputs: `bun.lock`, the root `tsconfig.json` and `packages/foundation/modeling/identity/src/packages.ts` all move, so the PR takes one CI binary closure release and pin cycle at merge. No row needs money or operator input, so P7 has no HOLD.
