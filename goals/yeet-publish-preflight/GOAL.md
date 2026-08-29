# GOAL: Harden yeet publish with a clean-HEAD install preflight and a fixed start-pr-early gate

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `yeet publish` proves the committed tree installs
(`bun install --frozen-lockfile` against a clean temp-worktree checkout of
HEAD) before every push, and `--start-pr-early` on a PR-less branch either
works with `--pr` or fails fast with an add-`--pr` hint — both shipped as a
mergeable PR.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/yeet-publish-preflight/README.md`
- `goals/yeet-publish-preflight/SPEC.md`
- `goals/yeet-publish-preflight/PLAN.md`
- `goals/yeet-publish-preflight/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli/src/commands/Yeet/**`,
  `packages/tooling/tool/cli/test/yeet.test.ts`,
  `.claude/skills/yeet/SKILL.md`, one changeset file, this packet's
  evidence files.
- Out: every other reflection todo (canvas CI lane, CauseTaggedError
  sweep), hosted CI workflows, unrelated yeet refactors, any other package.

Workflow:

1. P0 probe FIRST: reproduce both failure modes against current code
   (`SPEC.md` probe matrix) and record evidence — the 2026-07-13 incident
   may be stale; `internal/Handler.ts:344` already composes `--pr`.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, and command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/yeet-publish-preflight/GOAL.md)" -le 4000
jq . goals/yeet-publish-preflight/ops/manifest.json
git diff --check -- goals/yeet-publish-preflight
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
