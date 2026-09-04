# Complexity Ceiling Burn-Down Plan

## Status

Status: `active` (P0, P1, P2, and P4 complete locally; P3 publishing and
exact-head merge-readiness proof active)

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Refresh `research/tail-inventory.md` from a live `fallow health` run; record a triage verdict per tail function (refactor / override / ignore) with hotspot rank (`fallow health --hotspots`); adopt/defer verdicts for runtime-coverage CRAP and `fallow impact`. | Every tail function has a verdict; feature verdicts recorded with evidence. |
| P1 Implement | complete | Execute the five panel seams and every current tail-function verdict in hotspot order, batched by owning family; rebaseline at the final wave boundary. | All 30 refactor verdicts and 19 review-dated override verdicts executed; no ignores added. |
| P2 Verify | complete | `fallow:health:baseline:check` green; zero unwaived functions above cognitive 15; suppression total at most the latest-main comparator of 207 with no campaign additions; record 3 consecutive clean health-lane runs in `reports/clean-runs.md`. | Local verification matrix green on `53193e5a5e`; final 189-entry comparator matched with zero stale/moved entries. |
| P3 Yeet: PR to mergeable | active | Publish the completed lane-promotion campaign through Yeet and monitor the exact pull-request head. | Health lane blocking in hosted CI + local pre-push; exact head reports `merge-ready: yes`. |
| P4 Close | complete | Closeout reflection; same-PR packet status reconciliation; revisit-6 decision note appended to the DECISIONS entry. | Reflection passes lint; active manifest reflects local completion and P3 publication state. |

## P4 Closeout Checklist

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
