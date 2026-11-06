---
title: "Validate alchemy APIs against the installed beta.85, not the reference HEAD"
date: 2026-11-06
lane: "goals/alchemy-vault-sync-slice"
reversal: "Re-point the spikes and driver at the reference checkout once the trio is bumped to a release that matches it (a named goal task per D11)"
---

The reference checkout HEAD is 56 commits past `v2.0.0-beta.85` and differs in 29 kernel files (Event annotations, Query, Aggregate.Resolved). All API reads use the installed package source (it ships `src/` and agent docs) or `git show v2.0.0-beta.85:<path>`. Evidence: `goals/alchemy-vault-sync-slice/research/01-p0-spikes.md` section 0.
