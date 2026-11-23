---
title: "P2: commit 13 gates the check census and leaves the re-measure to the final check"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Run bun run beep quality check-census --write-baseline on this head and commit the rewritten standards/check-census.regression-baseline.jsonc."
---

Section 10 says the census is measured once at the end, on a built tree, after the last merge of the parent branch, and that merge has not happened. Commit 13 therefore runs the gate (bun run beep quality check-census --gate-only on a tree built with bunx turbo run build for the upstream of @beep/repo-cli, @beep/law-practice-domain and @beep/schema) and does not rewrite the baseline. The gate passes: @beep/law-practice-domain and @beep/schema are unchanged, @beep/repo-cli grew by 26602 instantiations (+0.32 percent, inside the 10 percent band) since the baseline of 2026-11-20, and no row failed. The re-measure with --write-baseline runs after the parent merge, before yeet final-check.
