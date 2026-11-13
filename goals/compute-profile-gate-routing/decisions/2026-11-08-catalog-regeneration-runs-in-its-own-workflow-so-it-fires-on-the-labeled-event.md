---
title: "Catalog regeneration runs in its own workflow so it fires on the labeled event"
date: 2026-11-08
lane: "goals/compute-profile-gate-routing-p2"
reversal: "Move the regenerate-catalogs job back into check.yml and accept that a single-push worker PR gets no regeneration"
---

yeet open pushes the head, creates the PR and then applies compute-profile-worker; check.yml listens to the default pull_request types (opened, synchronize, reopened), so the job would first run on the lane's next push. Adding `labeled` to Check's types would re-run every tier-1 lane on each label change, which ruling 51 (time-to-certainty B8) forbids. catalog-regeneration.yml listens to labeled, synchronize and reopened; the if guard keeps every other PR a skipped run. The label, not a receipt or a body marker, is the trigger because it is visible in the event payload with no extra API call.
