---
title: "Catalog regeneration runs in its own workflow so it fires on the labeled event"
date: 2026-11-08
reversal: "Move the regenerate-catalogs job back into check.yml and accept that a single-push worker PR gets no regeneration"
---

yeet open pushes the head, creates the PR and then applies compute-profile-worker; check.yml listens to the default pull_request types (opened, synchronize, reopened), so the job would first run on the lane's next push. catalog-regeneration.yml adds labeled; the if guard keeps every other PR a skipped run.
