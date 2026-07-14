# SPEC — Yeet Publish Preflight

Normative contract. `PLAN.md` sequences it; `GOAL.md` launches it.

## Mission

Harden the Yeet publish path with the two highest-leverage codification
todos from the pretext-driver closeout reflection
(`goals/pretext-driver/history/reflections/2026-07-14-claude.md`):

1. **Frozen-lockfile clean-HEAD preflight** — before any push, prove the
   COMMITTED tree installs: `bun install --frozen-lockfile` against a clean
   checkout of `HEAD` in a temporary `git worktree`, never against the
   dirty working tree.
2. **`--start-pr-early` ⇄ `--monitor` circular validation** — probe first,
   then make first-publish of a PR-less branch either work or fail fast
   with an actionable hint.

## Why (incident evidence)

- PR #391 (2026-07-13): all ~19 hosted jobs died in one shared setup step —
  the committed `bun.lock` referenced a manifest state that existed only in
  a sibling lane's staged-but-uncommitted working tree. Local gates passed
  because the dirty tree was self-consistent; only HEAD was broken. A ~6s
  local step (warm bun cache) replaces a 19-job CI wall and a full log-pull
  diagnosis cycle.
- 2026-07-13: `yeet publish --start-pr-early --monitor` could not be used
  for a branch's first publish — `--start-pr-early` requires `--monitor`
  (`internal/Guards.ts:139`) while the monitor path requires an existing
  open PR (`internal/PullRequest.ts`). Manual `git push` + `gh pr create`
  fallback was needed twice.

## Fix 1 — frozen-lockfile clean-HEAD preflight (normative)

- New publish plan step (id shape `publish:00-head-install-preflight`) that
  runs in BOTH post-commit publish paths (normal and `--start-pr-early`)
  BEFORE `git push`, and in the `verify` full tier so `yeet verify` catches
  the same desync.
- Behavior: `git worktree add --detach <tmp> HEAD` → `bun install
  --frozen-lockfile` with cwd `<tmp>` → ALWAYS remove the worktree
  (acquireRelease/ensuring; `git worktree remove --force` + prune on
  failure). `<tmp>` lives outside the working tree (system temp or
  `.git`-adjacent), never inside it.
- Failure is fail-closed: normal failure-packet path with a hint naming the
  frozen-install error and the likely cause (lockfile/manifest state
  committed on HEAD is incomplete — e.g. a sibling lane's uncommitted
  `bun.lock` entry) and the repair (commit/restage the lockfile, or
  `bun install` then restage).
- No skip flag unless testing proves the step needs one; if unavoidable,
  an explicit `--skip-head-install-preflight` opt-out, default OFF, with
  the skip recorded in the verdict artifact.
- The step's duration must be recorded like other plan steps (verdict
  lane timing), so regressions in preflight cost stay visible.

## Fix 2 — start-pr-early circular gate (probe-first, normative)

- P0 probe matrix on a scratch branch with NO open PR (use `--plan --json`
  first, then real runs where safe):
  1. `yeet publish --start-pr-early --monitor --message ...`
  2. `yeet publish --start-pr-early --monitor --pr --message ...`
  Record where each fails or succeeds (Guards vs monitor phase vs PR
  ensure), in `research/SOURCES.md` or PLAN evidence.
- Note: `internal/Handler.ts:344` already composes `--pr` after the early
  push, so the 2026-07-13 failure mode may now be conditional on omitting
  `--pr`. The fix must match observed behavior, not the reflection's
  memory of it.
- Required end state: on a PR-less branch, `--start-pr-early --monitor`
  WITHOUT `--pr` must fail FAST at guard time (before commit/push) with a
  hint to add `--pr` (preferred over auto-implying a GitHub write —
  consistent with closeout's explicit-writes doctrine). WITH `--pr` the
  flow must work end to end: early push → PR create → full proof → monitor
  against the created PR.
- Update the yeet skill doc (`.claude/skills/yeet/SKILL.md`): document the
  preflight under Authoritative Gates and replace the "--start-pr-early is
  the only..." / failure-handling notes if behavior changed.

## Scope guard

Exactly these two fixes. OUT: canvas CI lane for @beep/pretext,
CauseTaggedError sweep, any other reflection todo, unrelated yeet
refactors, changes to hosted CI workflows.

## Files

- `packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts` (flag
  surface only if strictly needed)
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Guards.ts`
  (fail-fast validation)
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts` (step
  wiring in both post-commit paths)
- Plan-step definitions (follow where `publish:02-pr-create` and the
  pre-push lanes are declared; likely `internal/PublishScope.ts` or a plan
  builder module — discover, do not guess)
- `packages/tooling/tool/cli/test/yeet.test.ts` (unit coverage, existing
  idioms)
- `.claude/skills/yeet/SKILL.md` (doc sync)
- Changeset: patch or minor for the CLI package per its versioning
  conventions (inspect sibling changesets).

## Acceptance

- [ ] P0 probe matrix recorded with observed failure points.
- [ ] Preflight step present in publish (both paths) and verify full tier;
      proven by unit tests AND one live negative probe: a scratch branch
      with an intentionally desynced committed `bun.lock` fails in the
      preflight step with the hint, before any push.
- [ ] `--start-pr-early --monitor` without `--pr` on a PR-less branch fails
      at guard time with the add-`--pr` hint; with `--pr` it completes.
- [ ] `npx vitest run` for the CLI package's yeet tests green; suite counts
      hold or grow.
- [ ] Skill doc updated; changeset present.
- [ ] PR to mergeable via yeet (completion gate).
