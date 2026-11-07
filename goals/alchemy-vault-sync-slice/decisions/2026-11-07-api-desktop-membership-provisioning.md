---
title: "Desktop membership rows ship with writer activation"
date: 2026-11-07
lane: "goals/vault-sync-api"
reversal: "Drop the shared_membership migration and seed; adapters keep failing closed"
---

The desktop PGlite migration bundle has no shared_membership table. Until activation adds it and seeds an active owner row for the desktop principal (user 1, org 1), every vault-sync adapter denies with ScopeDenied, which is the intended fail-closed state. This is an activation input for the cutover lane, not a permissive default.
