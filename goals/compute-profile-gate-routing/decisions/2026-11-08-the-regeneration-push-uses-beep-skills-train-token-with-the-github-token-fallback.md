---
title: "The regeneration push uses BEEP_SKILLS_TRAIN_TOKEN with the github.token fallback"
date: 2026-11-08
lane: "goals/compute-profile-gate-routing-p2"
reversal: "Swap the PUSH_TOKEN expression in the regenerate-catalogs job"
---

A push with `github.token` does not start new workflow runs, so hosted CI would never prove the regenerated head. The skills train token already has contents write on this repo and is used on an explicit URL only, never in git config. `github.token` stays as the fallback so a missing secret degrades to an unproven push instead of a failed job.
