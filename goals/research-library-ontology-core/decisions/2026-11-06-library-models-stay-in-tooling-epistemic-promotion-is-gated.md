---
title: "Library models stay in tooling; epistemic promotion is gated"
date: 2026-11-06
lane: "explore/research-library-ontology"
reversal: "Move the models to packages/epistemic/domain behind a promotion record once a second consumer exists; the CLI imports them"
---

The research library keeps its domain model inside commands/Research/Library; a versioned Turtle T-Box in the library root is the shareable artifact. Promotion to the epistemic slice fails the specific-home-first gate with one consumer. Build location stays in @beep/repo-cli; beep-cli-composition moves the group later.
