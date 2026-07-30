# Complexity Ceiling Burn-Down Plan

## Status

Status: `pending` (P0 next; PR1 of the campaign — gate, law, baselines,
suppression backfill, packet scaffold — landed from the 2026-07-30 calibration
session)

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Refresh `research/tail-inventory.md` from a live `fallow health` run; record a triage verdict per tail function (refactor / override / ignore) with hotspot rank (`fallow health --hotspots`); adopt/defer verdicts for runtime-coverage CRAP and `fallow impact`. | Every tail function has a verdict; feature verdicts recorded with evidence. |
| P1 Implement | pending | Wave 1: the five panel-named refactors (`research/calibration.md` §Panel). Waves 2+: tail functions in hotspot order, batched by owning family; Codex implements, Fable reviews. Rebaseline at each wave boundary in the wave's PR. | All refactor verdicts executed; overrides/ignores landed with reasons. |
| P2 Verify | pending | `fallow:health:baseline:check` green; zero critical complexity findings; suppression totals not above the 2026-07-30 inventory; record 3 consecutive clean health-lane runs in `reports/clean-runs.md`. | Verification matrix green or blockers attributed and documented. |
| P3 Yeet: PR to mergeable | pending | Lane promotion PR (PR2): move `health` to `FALLOW_BLOCKING_LANES` (`CiLane.ts:631`), baseline-compare argv + blocking predicate in `FallowQuality.command.ts` (drop `--report-only`, add `--baseline`); drive to mergeable. | Health lane blocking in hosted CI + local pre-push; PR mergeable. |
| P4 Close | pending | Closeout reflection; packet-state flip in the same PR as final work; revisit-6 decision note appended to the DECISIONS entry's thread if warranted. | Reflection passes lint; manifest statuses current. |

## P3 Closeout Checklist

1. Write a closeout reflection via `/reflect` to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; frontmatter must validate.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes; the user edits the tree in parallel.
- Wave PRs stay small enough for Greptile 5/5 and the 17-check ruleset;
  publish via yeet from feature branches only.
- Never run manual turbo/docgen concurrently with a background yeet verify.
- The judged-panel evidence (verdicts, natural ceilings, drivers) in
  `research/calibration.md` is the tie-breaker when a triage verdict is
  disputed: appeasement shapes (React conditional mounting, flat guard
  ladders, reference-algorithm ports) default to override, not refactor.
- Rebaseline commands: `bun run fallow:health:baseline:write` (wave boundary),
  `bun run fallow:health:baseline:check` (proof).

## Verification Commands

```sh
test "$(wc -m < goals/complexity-ceiling-burn-down/GOAL.md)" -le 4000
jq . goals/complexity-ceiling-burn-down/ops/manifest.json
rg -n "complexity-ceiling-burn-down|GOAL.md|agentLaunchers|packetAnchorDocument" goals/complexity-ceiling-burn-down
git diff --check -- goals/complexity-ceiling-burn-down
bun run fallow:health:baseline:check
bun run beep lint reflection-artifacts
```
