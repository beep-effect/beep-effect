---
title: "One record, agent and terminal projections; the CI projection is ci-gate-reports"
date: 2026-11-18
lane: "explore/agent-verification-output"
reversal: "Drop the terminal projection and leave humans on raw tool output"
---

Audience is detected through `@beep/runtime-env` and overridden by the `@beep/cli-kit` audience flags. This goal builds the agent projection (plain, bounded, verdict at head and tail) and the terminal projection (the same lines with colour and one live progress line). The CI projection, a GitHub job summary plus a grouped log, is goals/ci-gate-reports; until it lands, CI renders the agent projection. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `audience-three-projections`.
