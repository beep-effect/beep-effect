---
title: "Incremental per-file shard splice is the fix; ts-morph flags are not"
date: 2026-11-07
reversal: "Revert to whole-shard regeneration per owning package"
---

Measured 2026-11-07: skipFileDependencyResolution 5.31 to 5.23 GB, syntactic symbol lookup 5.05 GB, one small package 1.00 GB, CLI floor 0.35 GB. Cost is per-package ts-morph loading, so parse only staged files and splice entries (add/modify/delete/move). Exploration D2, D7.
