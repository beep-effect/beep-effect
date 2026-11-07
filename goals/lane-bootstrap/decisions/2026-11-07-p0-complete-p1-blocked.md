---
title: "P0 complete; P1 blocked on fleet-root-registry"
date: 2026-11-07
kind: checkpoint
lane: "docs/lane-bootstrap-p0-blocker"
reversal: "Delete this checkpoint file and set P0 back to pending in PLAN.md and ops/manifest.json."
---

P0 confirmed scope against live source (research/p0-live-source-scope.md). P1 needs the discovery-roots list, the registry overlay writer and the scan adoption that goals/fleet-root-registry P1 owns; none exist in source and no lane implements them. The operator ruling fleet-root-registry/decisions/2026-11-06-order-registry-first.md forbids stubbing them here, so P1 starts when that packet's PR merges. Also found: the creator is `worktree new`, not `worktree add`; fresh lanes are already hardlinked; no graft seed step exists.
