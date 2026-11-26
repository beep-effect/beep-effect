---
title: "P6: P6 ships as one PR stacked on the P5 branch, opened when the packet has fewer than three open PRs"
date: 2026-11-24
lane: "p6"
reversal: "Split P6 into an operations PR (rows 1-6) and an agent-surface and wall PR (rows 7-17), each stacked on its predecessor"
---

P6 depends on P5's term snapshot and on P4's admission arrows, and its rows are ordered so each compiles and passes its gate before the next. One PR stacked on the P5 branch keeps the closure pin cycle to one (Registry.data.ts and bun.lock both move) and keeps the packet under the three-open-PR limit (operator 2026-11-05). The implementation lane opens it only when the packet has fewer than three open PRs, merges its parent after each parent layer merges and re-runs the term snapshot writer with --base origin/main, as P5 did. Row 14's operational step is a HOLD; the code row merges.

Amended after independent review. The row table is 0-17 after the reorder (identity in row 3, MatterWall in row 8, ProvenanceTraversal and claim_provenance in row 13). Closure inputs per row: `bun.lock` changes in rows 1, 5, 7, 9 and 12; the root `tsconfig.json` in rows 1 and 2; `Registry.data.ts` in row 3. Row 14 stays an operational HOLD covering `apps/practice-kg-mcp`, `apps/practice-gateway` and docket intake, which refuse the old bundle.
