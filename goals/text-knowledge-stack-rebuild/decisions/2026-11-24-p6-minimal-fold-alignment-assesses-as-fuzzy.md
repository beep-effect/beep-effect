---
title: "Minimal-fold alignment assesses as fuzzy"
date: 2026-11-24
lane: "p6"
reversal: "Map match_minimal_fold to lesser in alignmentOf."
---

langextract reports four aligned statuses; the office-action profile has three aligned values. `match_exact` reads as `exact`, `match_lesser` (case-insensitive) as `lesser`, and both `match_minimal_fold` and `match_fuzzy` as `fuzzy`. Minimal fold also rewrites characters beyond case, so the conservative choice ranks it with fuzzy rather than lesser. Every aligned value passes the gate, so the mapping changes the assessment record and not admission. Code: `alignmentOf` in `OfficeActionReview.service.ts`.
