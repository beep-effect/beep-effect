---
title: "yeet gh pr status and merge read the shared review window"
date: 2026-11-12
lane: "feat/yeet-rewrite-stable-proof"
reversal: "Restore the GhOps window computation with its fixed 20-minute length."
---

`yeet gh pr status|merge` computed its own review window with a fixed 20 minutes, ignoring `BEEP_YEET_REVIEW_WINDOW`. It now takes the window instants from the shared reader, including the rewrite carry, and its length from the same configuration. Slice A had merged, so the change rides the slice B PR instead of a separate one.
