---
title: "An unchanged rewrite keeps proof that a new sha used to void"
date: 2026-11-12
lane: "feat/yeet-rewrite-stable-proof"
reversal: "Restore the exploration rule: any new sha voids the old proof and receipts."
---

For a GitHub rewrite the classifier calls unchanged, the 2026-11-10 window-on-rewrite decision supersedes the exploration rule "The new SHA voids old proof, receipts and merge-gate pins" (`explorations/stacked-pr-adoption/DECISIONS.md`). Only the review-window start and the final-check receipt carry. The receipt is still judged by the 2026-10-28 refresh facts, so only main's changes are excused, and a restack onto an updated base layer refuses. The merge-gate sha pin is unchanged: a gate pinned to the old head still refuses the new one.
