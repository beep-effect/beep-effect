---
title: "Completion core: unreadable fix PRs, missing fix PRs and v1 rows in lifecycle"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Drop the fix-pull-requests check and keep unreadable claims out, decode a missing PR as dropped once the port can tell 404 apart, and re-resolve v1 rows in projectGoalLifecycle."
---

Agent decision taken while implementing S4 of `research/design-pr-a.md` (DN-5, DN-8).

- DN-5, unreadable fix PR: a committed claim whose fix PR cannot be read is counted whenever it decides something: without it the verdict is not verified, and with it the verdict differs without becoming unsatisfied. That covers a claim that clears a red and a claim that covers a required context that never reported a run (DN-4 `missing`); counting only the first left a missing context structural, so one failed read made `goals doctor --online` block and the sweep raise a P0 row (review finding, 2026-11-13). The observation then adds a gating `hosted-required-checks` check with ref `fix-pull-requests`, outcome `unknown` and detail `fix PR #n unreadable`, and the receipt's `redAttributions` carries the claim. A stored row therefore re-resolves to the same transient unknown, and `goalCompletionUnknownReasons` names it. Keeping the claim out entirely, as the design words it, would make the outcome `unsatisfied` (a known red wins over gaps), which contradicts DN-5's 'a failed read makes the outcome unknown'. When the unreadable claim changes nothing, it stays out and the hosted detail names it.
- DN-5, missing fix PR: the completion port reports a 404 and a network failure as the same `YeetCommandError`, so a missing fix PR reads as unreadable (transient unknown), not as dropped. A fix PR closed without merging is dropped and named in the hosted detail.
- DN-8 in lifecycle: `projectGoalLifecycle` takes a verified v1 row as stored, as `storedGoalCompletion` returns it, instead of re-resolving it under the hosted-only rules. It goes in S6.

Reverse: drop the `fix-pull-requests` check and keep unreadable claims out, decode a missing PR as dropped once the port tells a 404 apart, and re-resolve v1 rows in `projectGoalLifecycle`.
