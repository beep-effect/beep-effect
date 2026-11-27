---
title: new CI lane contexts land non-required and are promoted only after a stable green history
date: 2026-11-26
reversal: Add a lane's context to ruleset 10240248 when the lane lands.
governs:
  - src/commands/Ci/CiLane.ts#CI_LANE_DESCRIPTORS
enforcedBy: []
---

A visible family context such as Ecosystem Contracts lands non-required; promotion is a later branch-ruleset action once it has a stable green history. Build (quality-lane audit D12) runs on pull requests affected-scoped with remote-cache read, while trusted main pushes run unscoped and are the only cache writer. It dispatches from heavy.yml, because the beep-ec2-heavy runner group admits heavy.yml@main on pull requests and not check.yml jobs, so its hosted context carries the Heavy prefix; it stays non-required until it has a stable green history.

Labs (lab-apps-lifecycle P2, ratified row 10) is the single visible labs proof lane: labs are excluded from every required Turbo lane (row 9), this lane positively selects the labs glob, and its "Labs" context is permanently non-required, never added to ruleset 10240248. Storybook (quality-lane audit D13) used to build and browser-test on every pull request with no gate, no descriptor and no local replay (584 s per pull request); its body now lives here, storybook.yml carries only the goals_only gate, the Playwright browser cache and the artifact upload, and "Storybook" joins the ruleset only after a stable green history.

Dependency review deliberately fails open: it needs GitHub's dependency-graph API, so it is CI-only, and the gate-integrity expectation file records that constraint.

Rejected: required-on-landing contexts, which turn a new lane's early flakes into merge blocks.
