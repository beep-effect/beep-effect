---
title: "Closeout check, views and doctor: window constant, live checker requirements and notes"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Move the window constant into CloseoutCheck.ts behind a shared leaf, pass the declaration digest into the live checker, split notes from reasons, let a ruling cover a closed-unmerged final, and restore the proposal phase exemption."
---

Agent decision taken while implementing S6 of `research/design-pr-a.md` (sections 1.7, 1.8, 2.6, 2.7; DN-13, DN-19).

- The 28-day window lives in `Completion.ts` as `GOAL_CLOSEOUT_WINDOW_DAYS` with the predicate `goalFinalWithinCloseoutWindow`, not in `CloseoutCheck.ts`. The DN-19 session filter in `readGoalCloseoutViews` needs it, and `CloseoutCheck.ts` imports `Completion.ts`, so defining it there would be an import cycle. `CloseoutCheck.ts`, the doctor's legacy pre-check and the session filter all read the one constant.
- `GoalCloseoutCheckerLive` also requires `Digest`: the observation and the stored-receipt read both digest the declaration. The live checker captures its build context and one memoized completion port, so `check` keeps an empty requirement channel.
- `GoalCloseoutCheck.reasons` carries the advisory notes as well as the reasons: an attribution conflict, an attribution naming a context that was neither red nor missing, and a verified `goal-completion-receipt/v1` row. Doctor prints them as notes for the non-blocking outcomes and inside the finding for `transient` and `unverified`.
- Classification follows the section 2.7 order literally: a final closed without merging is `unverified` before the operator-ruling step, so a ruling does not turn it into a note.
- `goalCloseoutView` is now pure (`dual`, no Effect), and `withGoalCompletionIo` is exported from `Completion.ts` so doctor provides one memoized port per online run without `Effect.provide(Layer)`.
- The `phases-terminal-but-active` exemption for proposals goes with the other proposal clauses (DR:816). Until S9 migrates them, an active proposal packet whose phases are all complete reports that blocking finding.

Reverse: move the window constant into `CloseoutCheck.ts` behind a shared leaf module, drop `Digest` from the live checker by passing the declaration digest in, move the notes to a separate `notes` field, let an operator ruling cover a closed-unmerged final, and restore the DR:816 proposal exemption.
