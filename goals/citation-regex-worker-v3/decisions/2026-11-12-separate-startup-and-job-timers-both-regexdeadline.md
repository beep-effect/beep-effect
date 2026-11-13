---
title: "Separate startup and job timers, both regexDeadline"
date: 2026-11-12
lane: "explore/citation-engine-install-and-worker-reuse"
reversal: "Fold startup into the first job's timer."
---

`regexDeadline` is at most one second and a spawn measured about 130 ms on a loaded host. Separate timers keep every job's matching bound independent of host load; the operation deadline still bounds the request. Source: `explorations/citation-engine-install-and-worker-reuse/DECISIONS.md`, per-job deadline accounting.
