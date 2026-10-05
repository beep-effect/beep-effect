# GOAL: ops seat timers

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `<fleet>/seats/ops` exists and every beep user timer and watch service runs from it: graft deep refresh, refs refresh, research daily and repo-card, residue reap, tmpfs reap, portfolio-watch, ai-metrics forwarder.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/ops-seat-timers/README.md`
- `goals/ops-seat-timers/SPEC.md`
- `goals/ops-seat-timers/PLAN.md`
- `goals/ops-seat-timers/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: timer and unit renderers under `packages/tooling/tool/cli/src/commands/{Research,Refs,Graft,Quality}`, `docs/runbooks/systemd-timers.md`.
- Out: timer behavior or schedules, clone retirement, forbidden installer forms. Depends on goals/fleet-root-registry landing first.

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
test "$(wc -m < goals/ops-seat-timers/GOAL.md)" -le 4000
jq . goals/ops-seat-timers/ops/manifest.json
git diff --check -- goals/ops-seat-timers
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
