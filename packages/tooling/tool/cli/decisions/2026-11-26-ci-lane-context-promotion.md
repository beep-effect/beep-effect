---
title: new CI lane contexts land non-required and join the ruleset after a stable green history; Labs never joins
date: 2026-11-26
reversal: Add a lane's context to ruleset 10240248 when the lane lands.
governs:
  - src/commands/Ci/CiLane.ts#CI_LANE_DESCRIPTORS
enforcedBy: []
---

A visible family context such as Ecosystem Contracts lands non-required; promotion into ruleset 10240248 is a later branch-ruleset action once the context has a stable green history, and Heavy / Build and Storybook wait for that history. Labs is the exception: its context stays permanently non-required.

Rejected: required-on-landing contexts, which turn a new lane's early flakes into merge blocks.
