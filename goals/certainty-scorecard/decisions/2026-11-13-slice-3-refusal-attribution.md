---
title: "Slice 2 merged; slice 3 (MEAS-02 with DEPS-10) attributes refusals by failure kind"
date: 2026-11-13
kind: checkpoint
lane: "claude/determined-morse-ea66a8"
reversal: "Revert the slice-3 commit (actionableLane returns to the failed-step fallback) and delete this checkpoint so the slice-2 checkpoint is the latest PLAN status note."
---

Slice 2 (ROUT-05 slice 1) merged as #3141. Slice 3 fixes `actionableLane` in `packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts` on the read side: a handler-error verdict names the first unexecuted planned step as `failedStepId` (`Handler.ts`), so refusals were charged to `publish:00-head-install-preflight`. Refusals are now classified first, as rows of the same `actionableLaneMix`: `refusal:lock-bounce`, `refusal:stale-base` (the publish stale-base refusal sentence) and `refusal:closeout` (any red closeout). Then the first failed inner lane, then `failedStepId` only for a `step-exit` failure, then the first failed lane, then `unexecuted` (a handler error that ran no lane) or `unlocated`. Every red attempt stays one row, so the mix total equals `redAttempts` and the WaveOrder `mixSum` check keeps holding; `unchangedFingerprint.byActionableLane` uses the same classes. The writer in `Handler.ts`, `WaveOrder.ts`, `EconomicsSeedSourceView` and the frozen `goals/time-to-certainty/research/economics.json` are unchanged; the re-seed belongs to local-proof-under-ten (YEET-07). Rejected: filtering refusals out of the mix (breaks the `redAttempts` invariant and the seed check) and changing the writer (old journal rows would still carry the preflight id).
