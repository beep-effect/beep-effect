# GOAL: legacy drain

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: every `~/YeeBois/projects/beep-effect*` clone and lane is either registered `legacy` and still in use, or reaped by residue-reap's drainable class after its grace window; `standards/git-worktrees.md` describes seats and lanes.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/legacy-drain/README.md`
- `goals/legacy-drain/SPEC.md`
- `goals/legacy-drain/PLAN.md`
- `goals/legacy-drain/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `internal/repo-run/ResidueReap*.ts`, `standards/git-worktrees.md`, `AGENTS.md` worktree bullet, journal output.
- Out: cutover dates, live checkouts, the private repo, telemetry data. Depends on goals/fleet-root-registry, goals/lane-bootstrap, goals/ops-seat-timers landing first.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill (see
   `PLAN.md` P4 Closeout Checklist); `bun run beep lint reflection-artifacts`
   must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/legacy-drain/GOAL.md)" -le 4000
jq . goals/legacy-drain/ops/manifest.json
git diff --check -- goals/legacy-drain
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
