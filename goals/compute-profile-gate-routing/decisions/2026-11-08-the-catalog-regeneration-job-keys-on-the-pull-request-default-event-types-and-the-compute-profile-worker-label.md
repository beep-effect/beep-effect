---
title: "The catalog regeneration job keys on the pull_request default event types and the compute-profile-worker label"
date: 2026-11-08
lane: "goals/compute-profile-gate-routing-p2"
reversal: "Add labeled to check.yml pull_request types, or delete the regenerate-catalogs job"
---

Adding `labeled` to Check's `pull_request` types would re-run every tier-1 lane on each label change, which ruling 51 (time-to-certainty B8) forbids. The job therefore starts with the first push after `yeet open` labels the draft. The label, not a receipt or a body marker, is the trigger because it is visible in the event payload with no extra API call.
