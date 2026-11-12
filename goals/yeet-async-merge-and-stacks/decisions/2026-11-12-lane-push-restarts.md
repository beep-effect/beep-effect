---
title: "A lane push restarts the window and grants no new receipt carry"
date: 2026-11-12
lane: "feat/yeet-rewrite-stable-proof"
reversal: "Classify fast-forward moves too and carry across them."
---

A fast-forward lane push restarts the review window, and slice B grants it no new receipt carry. The 2026-10-28 ancestor refresh rule for receipts is unchanged. A GitHub rewrite followed by a lane push is not carried: the classifier sees a lane-committed commit and answers changed, so the next `yeet final-check` runs on the new head.
