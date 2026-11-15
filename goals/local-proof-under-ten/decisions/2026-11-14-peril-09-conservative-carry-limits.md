---
title: "PERIL-09: base-merge carry stops at a GitHub rewrite and at a moved hunk context"
date: 2026-11-14
lane: "feat/local-proof-review-window-anchor"
reversal: "Compose the merge walk with the rewrite walk (merge-base of the root and base.sha as the rewrite base) or compare patches without context lines; both widen what carries."
---

Two cases re-arm although the pull request's own lines did not change, both on purpose, because unknown is never unchanged. First, the merge walk follows only push rows and the rewrite walk only force-push rows, chosen by the head: a base merge on top of a GitHub-cascaded head counts from the cascade's push, not from the push before it, because the rewrite proof needs the cascade's own linear base and `base.sha` is the base at the merge's synchronization. Second, the patch identity keeps context lines, so a base change within three lines of a PR hunk changes the identity and re-arms (the recorded `HX` fixture). The reviewers' diff did change in both cases, only less than a fix push would. Rejected: carrying across a rewrite with an inferred base (one more inference on the merge path) and a context-free identity for merges only (a second patch-identity rule beside the one the rewrite proof and final-check refresh share in `PatchIdentity.ts`).
