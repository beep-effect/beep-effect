# Opportunities — friction receipts

Record friction the moment it happens: what you were doing, the evidence (command, error text, PR or
file), and what would have prevented it. Redact secrets, rewrite home paths to `~`, drop session and
machine identifiers; this repository is public.

## 2026-11-09 — efficiency plans lived outside the repo

- **What was happening:** briefing the phase 1 readers on prior art.
- **Evidence:** two 2026-11-09 efficiency plans (lint; test and coverage) with ranked, contested and killed
  sections existed only in session scratchpads under `~/.cache/claude-tmp/`, reachable only through
  agent-memory pointers. A reader that lacked the pointer would have re-derived a 70-minute baseline.
- **What would have prevented it:** this packet. Plans with killed and contested sections belong under a
  packet's `research/` from their first draft.

## 2026-11-09 — the economics report misattributes first reds

- **What was happening:** reading `bun run beep yeet economics` to rank the first-red lanes.
- **Evidence:** `actionableLane` falls back to `verdict.failedStepId`, so 46 of 46 local (182 fleet)
  "head-install-preflight" first reds are 2026-08-26 proof-lock handler errors in which the preflight never
  ran; the preflight passed 153 of 153 locally. One phase 1 lever (Y1) was built on that artifact before the
  deps-toolchain reader caught it.
- **What would have prevented it:** a `failureKind` guard in `Economics.ts` before the fallback, and a
  fixture with a handler-error attempt whose first plan step never started.
