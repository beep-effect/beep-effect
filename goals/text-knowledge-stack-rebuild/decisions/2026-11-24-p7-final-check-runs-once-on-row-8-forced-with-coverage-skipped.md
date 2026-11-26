---
title: "P7: final-check runs once on the row-8 head, forced and uncached, with coverage skipped for hosted CI, and row 9 stays inside the refresh allowlist"
date: 2026-11-24
lane: "p7"
reversal: "Run final-check unskipped on the row-9 head after yeet open, accepting a second forced run and local repo-cli coverage"
---

The final PR runs `bun run beep yeet final-check` once, on the row-8 head, before `bun run beep yeet open`. Three facts shape that run.

- The receipt must cover the pushed head (`PLAN.md:32`). Row 9 is pushed after `yeet open`, and the refresh rule accepts only own changes to four standards inventories and the goal packet's `SPEC.md`, `PLAN.md`, `README.md`, `ops/manifest.json` and reuse ledgers (`packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheckRefresh.ts:100-121`, refusal at `:199-205`). So row 9 holds only what `goals set-status` writes to the manifest and README, and the amendment status edit in `standards/architecture/DECISIONS.md` moves to row 8 (decision `one-decisions-entry-records-the-landings-and-the-amendment-expires-at-closeout`).
- `bun.lock` changes in P7, so the run sets `TURBO_FORCE` and nothing is served from cache (`Yeet/internal/TurboForce.ts:6-10`).
- Rows 1 and 3 touch `@beep/repo-cli`, so an unskipped coverage gate would run whole-package repo-cli coverage locally, which the workstation rules forbid. The run is `nice -n 19 ionice -c3 bun run beep yeet final-check --skip coverage="hosted Coverage Regression proves repo-cli; no local whole-package coverage"`, run alone. If scheduler admission or a gate waits 10 minutes, the AGENTS.md constrained-compute rule applies: keep the package-scoped checks that passed and record each further skipped gate with `--skip <gate>=<reason>` on the receipt.
