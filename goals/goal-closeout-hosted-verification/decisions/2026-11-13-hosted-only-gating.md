---
title: "Completion gates only on hosted required checks and review threads, read through one memoized live port"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Drop hosted-review-threads, restore a non-gating readLocalEvidence and the accepted-head digest reason, and use one adapter per read."
---

Agent decision (`research/design-pr-a.md` DN-7, DN-9, DN-12, DN-25). DN-25 is amended by orchestrator ruling 2026-11-12.

- DN-7: review threads are a gating hosted fact, `hosted-review-threads`. They are read at refresh time through `ReviewThread.list` and `outstanding`: 0 outstanding verifies, more than 0 is unsatisfied, and a failed read is a transient unknown.
- DN-9: the local `.beep/yeet/runs/*/verdict.json` is not read; `readLocalEvidence` is deleted. The 38 declared `yeet-verdict` refs stay in their manifests (so their digests do not change) and gate nothing. Only `GoalHostedEvidenceKind` gates.
- DN-12: the accepted-head manifest no longer gates. The `accepted-declaration` sub-claim becomes a non-gating self-naming check.
- DN-25 (ruling): `GoalCompletionIoLive` is exported from `CompletionEvidence.ts`, next to `GoalMergeTimeEvidenceProviderLive`. `CompletionEvidence.service.ts` stays type-only, which avoids a runtime import cycle. One layer per command run memoizes `ruleSuites` with `Cache.makeWith(lookup, { capacity: 64, timeToLive: (exit) => Exit.isSuccess(exit) ? Duration.infinity : Duration.zero })`, keyed by root and ref, so a failed listing is never replayed. Effect 4.1.4 has no `Effect.cachedFunction`. Merges older than 31 days skip the listing and record `rule-suite-unavailable`. Every new adapter gets a live-layer test.

Reverse: drop the `hosted-review-threads` kind, restore a non-gating `readLocalEvidence`, restore the accepted-head digest reason, and go back to one adapter per read.
