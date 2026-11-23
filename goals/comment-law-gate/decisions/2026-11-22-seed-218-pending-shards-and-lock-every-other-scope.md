---
title: "Seed 218 pending shards and lock every other scope"
date: 2026-11-22
lane: "goals/comment-law-gate"
reversal: "Delete standards/comment-law/pending and the lock half of beep laws comments; the growth check stands alone."
---

beep laws comments --write seeded one shard per package root holding a banned comment (218, one of them _root.jsonc for loose root files), each listing the whole root. Every other scope is locked at zero. The list may only shrink: a head scope outside every merge-base scope of the same root fails, and a scope emptied by a change must leave the list in that change. The seed carries no counts and no per-comment inventory (S31). The bootstrap PR is the one run whose merge base has no policy file, so it is the only one that skips the shrink-only guard.
