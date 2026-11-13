---
title: "Scorecard field census: the main verdict rate is reported, pickup p95, heavy-wait p95, job counts and the cancel actor are not"
date: 2026-11-13
lane: "claude/amazing-swirles-67011b"
reversal: "When a certainty-scorecard slice adds the missing fields, record a decision naming them and release slice 2 from the stop condition."
---

P0 fact: which certainty-scorecard fields this goal is judged on exist on `main` (read at 7a462a27d4f, after #3118). `bun run beep ci certainty` emits `CiCertaintyReport` (`schemaVersion` `ci-certainty-report/v1`) from `packages/tooling/tool/cli/src/commands/Ci/Certainty.schemas.ts`.

Present:

- Main verdict rate over non-docs first-parent SHAs: `CiCertaintyReport.main` (`CiCertaintyMainStat`: `commits`, `docsCommits`, `verdicts`, `cancelled`, `noRun`, `open`, `unread`, `rate`) and `CiCertaintyReport.mainRows` (`CiCertaintyMainRow`: `sha`, `committedAt`, `docsOnly`, `runIds`, and `verdict`, a `CiCertaintyMainVerdict` of `success`, `failure`, `cancelled`, `no-run`, `open` or `unread`). Since #3168 (3b85830d051) the push listing is read before the pull-request job reads, and an incomplete listing marks every main commit `unread` and leaves `rate` empty instead of folding them to `no-run`; a consumer of `mainRows` (re-dispatch, slice 4) must treat `unread` as unknown, never as missing. This is the before/after verdict read and the missing-verdict list re-dispatch (slice 4) needs; history note `2026-11-13-pre-ban-main-verdict-rate` records the first read (refused before #3168, the main block an artifact) and the second, complete main read after it: 70 of 283 non-docs commits verdicted, rate 24.7%.
- Admission to Heavy: `CiCertaintyReport.admissionToHeavy` (`CiCertaintyAdmissionStat`: `n`, `p50Minutes`). #3144 (merged) redefined it as heavy-pool pickup per producer run and the runner-minutes rows (`CiCertaintyRunnerStat`) as per head attempt, keeping the field names; cite #3144 when reading either.
- Push-to-required-green latency (`slo`, `mergeable`, `greenOnly`: `CiCertaintyLatencyStat`) and the Test Unit conversion row (`CiCertaintyTestUnitConversion.fullLayoutJobs`, Test Unit partition jobs only).

Missing:

- PR first-wave pickup p95: no field. `CiCertaintyLatencyStat` measures push to required green, not run creation to first job.
- Heavy-wait p95: `CiCertaintyAdmissionStat` has a p50 and no p95; `CI_CERTAINTY_NOT_COVERED` in `packages/tooling/tool/cli/src/commands/Ci/Certainty.ts` defers "the main run cancel actor and heavy-queue pickup p95 (later slices)".
- Hosted jobs per run: no field (runner-minutes, not job counts). The research note `2026-11-13-check-run-queue-day-measure.md` has two measured days (decision `check-run-queue-measurements`), not a scorecard row.
- Main run cancel actor: `CiCertaintyMainStat.cancelled` counts cancelled verdicts with no actor; deferred by the same `CI_CERTAINTY_NOT_COVERED` entry. Zero-agent-cancel acceptance cannot be read without it.
- Heavy identity beside each main verdict: `CiCertaintyMainRow` carries no resolved `heavy.yml@main` identity, although the SPEC's verdict-identity constraint says the scorecard reports it.
- The hosted concurrent-job ceiling: `CI_CERTAINTY_NOT_COVERED` ("no admin read").

The certainty-scorecard SPEC lists first-wave pickup p95, heavy-wait p95, the cancel actor and the replay inputs among the numbers it reports for this goal ("Numbers the scorecard reports"), but its PLAN has no slice that builds any of them: slices 1 to 17 cover the report, partition mapping, refusal attribution, the nightly workflow, journals, fleet reads, terminations, step fields, unit-result timings, the ledger fold and PSI joins. Under SPEC "Stop Conditions" ("cannot report the main verdict rate, first-wave pickup or heavy wait") slice 2 (the replay) stays held, and with it slices 3 and 4, which gate on the replay. This goal builds no second census; the gap is reported to the certainty-scorecard owner.
Source: `Certainty.schemas.ts` and `Certainty.ts` at 7a462a27d4f; goals/certainty-scorecard/SPEC.md ("Numbers the scorecard reports") and PLAN.md (Slices); PR #3144 body ("Report rows that change meaning").
