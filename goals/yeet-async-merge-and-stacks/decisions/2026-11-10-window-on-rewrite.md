---
title: "An unchanged patch-id keeps the review window and the receipt"
date: 2026-11-10
lane: "docs/stack-test-results"
reversal: "Restart the window and void the receipt on every head move, as today."
---

A GitHub-initiated rewrite whose patch-ids match keeps the review-window start and carries the final-check receipt; a changed patch-id or any lane push restarts both. In the test the window restarted twice in 30 minutes and the second merge waited 29 minutes for an unchanged diff. Source: `explorations/stacked-pr-adoption/DECISIONS.md`, `review-window-on-cascade` and `stack-test-result`.
