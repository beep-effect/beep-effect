---
title: "PERIL-09: a base-merge carry spends GitHub reads only while the push holds the window"
date: 2026-11-14
lane: "feat/local-proof-review-window-anchor"
reversal: "Drop the pushHolds and isMergeCommit gate in readWindowCarry so every window read with a classifier reads the pull and the ref activity."
---

The window is read on every monitor poll once it is the last blocker, and the REST budget is shared by every monitor (D16), so the base-merge carry must not add a read to ordinary pushes. `readYeetReviewWindowEvidence` first computes the uncarried push instant; only while that push still holds the window (less than the window length ago) does it run the classifier's local `isMergeCommit` probe on the head, and only a two-parent head reads the pull (when no caller supplied it) and the branch's ref activity. An elapsed window and a plain commit cost no extra GitHub read, and a GitHub rewrite keeps #3130's path unchanged (force pushes in the timeline still trigger it). The probe fetches a missing head object from origin, as the classifier already did, so a merge GitHub made with Update branch is proven from any checkout. Rejected: always reading the activity when a classifier is present (one or two extra REST calls per window poll on every pull request) and probing only local objects without a fetch (the merge gate runs from checkouts that lack other lanes' heads).
