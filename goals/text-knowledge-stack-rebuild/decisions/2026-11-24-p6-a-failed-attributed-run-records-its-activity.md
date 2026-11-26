---
title: "P6: a typed failure of an attributed run records its activity in a LoggedFailure; L5-3 covers failing pipelines"
date: 2026-11-24
lane: "p6"
reversal: "Record activities only for successful runs and restrict L5-3 to them"
---

Independent review of the P6 design. The first draft built the activity record only from a successful value, so a failed run emitted none and L5-3, quantified over successful runs, could not see 'a run with no activity' for any failure; the generator's fail flag reached no property. withActivity's error channel becomes LoggedFailure<E | EF | PreimageMintError> { error, activities }. A typed failure of the wrapped run (caught with Effect.catch, effect/Effect.ts:2809,2851) carries one ActivityRecord with outcome failed, generated empty and ended read at the failure; a failure of the facts function or of mintActivityId precedes the start and carries an empty log; a defect or an interruption records nothing, as the declared observation excludes them. composeLogged joins the upstream log into a downstream failure. ActivityRecord gains outcome: ActivityOutcome (LiteralKit completed, failed), outside the activity/v1 preimage, with a filter that a failed record generates nothing. L5-3 quantifies over every run: on failure |L| equals the number of steps that started, the failing one included, and exactly one record is failed. A control with a success-only recorder fails the count. Amends 2026-11-24-p6-with-activity-mints-at-start-exposes-current-activity-and-composes-as-a-writer.
