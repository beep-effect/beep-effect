# GOAL: lane bootstrap

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `beep worktree add <slug>` is the only sanctioned lane creator: it creates the worktree under `<fleet>/lanes/<slug>`, registers it, installs with Bun's hardlink backend verified, points `TURBO_CACHE_DIR` at the shared cache, seeds graft from the ops seat, and the same scan adopts desktop-app and Codex lanes.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/lane-bootstrap/README.md`
- `goals/lane-bootstrap/SPEC.md`
- `goals/lane-bootstrap/PLAN.md`
- `goals/lane-bootstrap/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli/src/commands/Worktree/**`, registry writer, lane bootstrap steps, `docs/runbooks/`.
- Out: install backends, deletion, timer units, standards rewrite. Depends on goals/fleet-root-registry landing first.

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
test "$(wc -m < goals/lane-bootstrap/GOAL.md)" -le 4000
jq . goals/lane-bootstrap/ops/manifest.json
git diff --check -- goals/lane-bootstrap
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
