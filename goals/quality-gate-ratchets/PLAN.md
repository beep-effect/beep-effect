# Quality Gate Ratchets Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Lanes | in_progress | Codex lanes: wave 1 = A1 coverage, A3 boundaries, A6 commitlint (disjoint files, parallel worktrees); wave 2 = A2 knip then A4 jsdoc (both touch Quality/Tasks.ts + check.yml, sequential). | Each lane's deliverable lands on the goal branch with Fable diff review. |
| P1 Proofs | pending | Two-way synthetic-regression proof per gate, logged in history/gate-proofs.md. | Every gate fails on regression, passes on revert. |
| P2 Ship | pending | yeet repair → verify → publish --pr → monitor; greptile closeout; user merges. | Single PR merged. |
| P3 Ruleset | pending | A5: Claude updates ruleset 10240248 via gh api; direct-push refusal tested. | Ruleset live, refusal proven, a subsequent PR merges normally. |
| P4 Close | pending | /reflect, README/manifest sync, memory updates. | Closeout checklist done; reflection lint passes. |

## P4 Closeout Checklist

1. `/reflect` → `history/reflections/<date>-<agent>.md` (quote the date;
   no backtick-leading plain scalars).
2. `bun run beep lint reflection-artifacts`.
3. Update `README.md` + `ops/manifest.json` statuses.

## Execution Notes

- **Codex conventions**: one lane = one agent = one sibling worktree
  (`beep worktree new gate-<lane>`) = one deliverable; background-first;
  deliverable-on-disk + summary file; fresh relaunch over resume; NO GitHub
  API calls from codex (Claude does A5 and all gh writes).
- Lanes branch from `feat/quality-gate-ratchets`; Claude merges each lane
  branch back after review. A2 rebases on A4's... no: A2 first, then A4
  rebases on A2 (both edit Quality/Tasks.ts + check.yml).
- Reuse, don't fork, the #294 per-owner ratchet machinery for A4 (and as the
  baseline-compare pattern for A1/A2 where it fits).
- Baseline regeneration commands documented next to each baseline file.
- Preserve unrelated worktree changes; conventional commits only.

## Verification Commands

```sh
test "$(wc -m < goals/quality-gate-ratchets/GOAL.md)" -le 4000
jq . goals/quality-gate-ratchets/ops/manifest.json
git diff --check -- goals/quality-gate-ratchets
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
