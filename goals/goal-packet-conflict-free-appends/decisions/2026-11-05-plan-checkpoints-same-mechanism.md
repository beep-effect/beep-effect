---
title: "PLAN.md checkpoints ride the same mechanism as kind: checkpoint"
date: 2026-11-05
lane: "feat/goal-packet-decision-files"
reversal: "Drop the checkpoint literal from GoalDecisionKind and the PLAN.md target from GOAL_DECISION_TARGETS; the SPEC.md projection is unaffected."
---

The conflicting PLAN.md edits were status notes ("Current checkpoint", "Current diagnostic preparation") appended to the plan tail, the same shape as the SPEC.md decisions. Rather than a second generator, a decision file may carry `kind: checkpoint`; it then renders into the `## Checkpoints` block of PLAN.md instead of SPEC.md. One schema, one renderer, one splicer, two targets. Phase tables and other authored PLAN.md content stay hand-edited.
