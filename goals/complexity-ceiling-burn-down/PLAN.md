# Complexity Ceiling Burn-Down Plan

## Status

Status: `active` (P0 and P1 complete; P2 hosted verification, P3
merge-readiness, and P4 final closeout remain open)

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Refresh `research/tail-inventory.md` from a live `fallow health` run; record a triage verdict per tail function (refactor / override / ignore) with hotspot rank (`fallow health --hotspots`); adopt/defer verdicts for runtime-coverage CRAP and `fallow impact`. | Every tail function has a verdict; feature verdicts recorded with evidence. |
| P1 Implement | complete | Execute the five panel seams and every current tail-function verdict in hotspot order, batched by owning family; rebaseline at the final wave boundary. | All 30 refactor verdicts and 19 review-dated override verdicts executed; no ignores added. |
| P2 Verify | active | Final wave: shrink the health baseline to 185 entries, tighten the tooltip waiver, and record three clean comparisons. | Focused health, audit, suppression, and package handoffs pass; published-head hosted checks must pass. Full local proof is skipped per the user's 2026-09-08 instruction. |
| P3 Yeet: PR to mergeable | active | Publish ready fixes immediately through `yeet publish --fast --monitor`. | PR #1021 reports `merge-ready: yes`, with Greptile 5/5, zero issues, and no unresolved review threads on its final head. |
| P4 Close | active | Closeout reflection and same-PR packet status reconciliation; retain the recorded revisit-6 decision. | Reflection and final evidence are prepared; flip lifecycle only after the hosted completion audit passes. |

## P4 Closeout Checklist

1. Write a closeout reflection via `/reflect` to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; frontmatter must validate.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes; the user edits the tree in parallel.
- Wave PRs stay small enough for Greptile 5/5 and the current required-check ruleset;
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
