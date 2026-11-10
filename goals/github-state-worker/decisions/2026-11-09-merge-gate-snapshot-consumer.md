---
title: "merge-gate is a snapshot consumer only"
date: 2026-11-09
reversal: "Remove the snapshot-first hold so merge-gate reads GitHub directly on every attempt again."
---

merge-gate holds with no API call while checks are pending or the review window is open, then does one authoritative head-pinned re-read before merging. Adopting GitHub's merge queue stays in explorations/github-merge-queue. Saves about 13-17 to 2-3 REST per held attempt.

Source: exploration `explorations/github-api-quota/DECISIONS.md`.
