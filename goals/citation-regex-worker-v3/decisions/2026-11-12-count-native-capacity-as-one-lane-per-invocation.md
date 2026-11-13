---
title: "Count native capacity as one lane per invocation"
date: 2026-11-12
lane: "explore/citation-engine-install-and-worker-reuse"
reversal: "Restore one lease per child process."
---

A request-long regex lease would starve the same request's Diff and Xml processes, which share the total ceiling. Each admitted operation holds one lane with at most one child alive; a Diff or Xml job retires the idle regex worker first, with confirmation. Operator answer, exploration shape review. Rejected: release and reacquire per job (can queue behind another request) and raising the ceiling (doubles the live child bound). Source: `explorations/citation-engine-install-and-worker-reuse/research/design-review-2026-11-12.md`, finding 1.
