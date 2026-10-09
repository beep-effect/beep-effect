# Stage 1 receipt — ownership and recovery (2026-10-09)

Exit condition (PLAN, Staged Acceptance Checklist, stage 1): active owners and
recovery paths recorded; no unrelated state adopted or discarded. This receipt
closes stage 1 for the `repository-simplification-confidence` program. The
revision facts, tool versions and lane heads it relies on are in
[`research/baseline-2026-10-09.md`](../../research/baseline-2026-10-09.md);
this file records what stage 1 preserved and where each recovery copy is.
Written by the program orchestrator from the packet lane at 2026-10-09T15:51Z.
Home-relative paths use `~`.

## 1. Fleet ownership at take-over

- The fleet orchestrator role was taken over by the program orchestrator on
  2026-10-09 (register and `HANDOFF.md` under `~/.cache/beep/orchestrator/`).
  The previous fleet handoff is snapshotted as
  `~/.cache/beep/orchestrator/HANDOFF.prev-20261009T133842Z.md`; recovery is
  to read that snapshot and re-register its rows.
- Live sessions and clones listed in the baseline keep their owners. Stage 1
  adopted no lane, branch, stash or checkout that belongs to another session;
  the `build-pipeline-simplification` session and its lanes stay untouched
  (SPEC constraint).

## 2. `effect-vitest-canon` lanes — preserved, not touched

Clone `beep-effect2`, worktree root `beep-effect2-worktrees/`. Heads read on
2026-10-09T15:50Z with `git status --porcelain`, `git rev-parse HEAD`,
`git diff --cached | sha256sum` and `git diff | sha256sum` (first 16 hex
digits). No source worktree was modified, reset, stashed, swept or removed at
stage 1; lane V (`rsc-v-vitest-canon`) performs the read-only exports in its
preservation step and records them in
`history/receipts/stage-4-vitest-reconciliation.md`.

| Worktree | Branch | Head | Staged | Unstaged | Untracked | Digest of pending diff |
| --- | --- | --- | --- | --- | --- | --- |
| `effect-vitest-canon-baseline` | `codex/effect-vitest-canon-baseline` | `bd7a8e0301` | 0 | 0 | 0 | none |
| `effect-vitest-canon-continuation` | `codex/effect-vitest-canon-continuation` | `e4c608f9c1` | 5 | 0 | 0 | staged `70f994b8e2208496` (100 diff lines) |
| `effect-vitest-canon-detector-resources` | `codex/effect-vitest-canon-detector-resources` | `38890b61aa` | 0 | 6 | 0 | unstaged `fed0fc65ff4f4548` (1,121 diff lines) |
| `effect-vitest-canon-property-boundaries` | `codex/effect-vitest-canon-property-boundaries` | `346ebd8447` | 0 | 0 | 0 | none |
| `effect-vitest-canon-property-values` | `codex/effect-vitest-canon-property-values` | `d64a63ec8f` | 0 | 0 | 0 | none |
| `effect-vitest-canon-resource-next` | `codex/effect-vitest-canon-resource-next` | `813d406ac9` | 0 | 0 | 0 | none |

Staged in `effect-vitest-canon-continuation` (all under
`goals/effect-vitest-canon/`): `README.md`, `SPEC.md`,
`ops/inventory/digests/beep_repo-cli.md`, `research/OPPORTUNITIES.md`
(modified) and `research/cli-consolidated-conflict-proof.md` (added).

Unstaged in `effect-vitest-canon-detector-resources` (all under
`packages/tooling/tool/cli/test/`): `cache-evidence.test.ts`,
`lint-judge-rubric.test.ts`, `lint-subcommand-allowlist.test.ts`,
`native-runtime-prefix.test.ts`, `runtime-root.test.ts`,
`test-typecheck-coverage.test.ts`.

None of the six branches has an upstream. The clone's stash list (shared by
every linked worktree because `refs/stash` lives in the common `.git`) holds
40 entries; none was created, applied or dropped at stage 1, and lane V treats
them as another session's state unless a sweep names one.

Lane V's integration worktree is `effect-vitest-canon-integrate` (branch
`chore/rsc-v-vitest-canon`), cut by the orchestrator; the gap-19 residue
worktrees (`effect-vitest-*`, 41 directories beside the canon lanes) are
enumerated and dispositioned by lane V, not here.

## 3. Global configuration — stage-1 copies (RULINGS R55)

Taken on 2026-10-09T15:51:00Z with `cp -p` into `~/.config-backups/` before
lane F (`rsc-f-agents`) launches. Rollback for any owned-field apply is to copy
the file back over its source and rerun the drift check
(`bun run beep models check` for model fields).

| Source | Copy (in `~/.config-backups/`) | sha256 (16) | Bytes |
| --- | --- | --- | --- |
| `~/.codex/config.toml` | `rsc-stage1-20261009T155100Z--.codex__config.toml` | `d789089d816e8dc0` | 119,798 |
| `~/.claude/settings.json` | `rsc-stage1-20261009T155100Z--.claude__settings.json` | `011db7693f1e788e` | 5,399 |
| `~/.config/beep/models.yaml` | `rsc-stage1-20261009T155100Z--.config__beep__models.yaml` | `980c0402cd0b77ba` | 22,793 |

## 4. Recovery paths confirmed

Every recovery mechanism in PLAN "Recovery Paths" has its precondition in
place at stage close: the fleet handoff snapshot exists (section 1), the
preserved lane state is digested (section 2), the home-config copies exist
(section 3), and the baseline records the revisions to compare against.
Nothing was deleted, archived or moved at stage 1.
