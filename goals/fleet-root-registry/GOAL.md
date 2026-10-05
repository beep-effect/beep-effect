# GOAL: fleet root registry

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: every path-dependent beep CLI surface reads one fleet-root setting, and a schema-first authored registry (seat role, lane slug, packet, PR, drain status) is joined onto the derived `beep worktree fleet` mirror in one view.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/fleet-root-registry/README.md`
- `goals/fleet-root-registry/SPEC.md`
- `goals/fleet-root-registry/PLAN.md`
- `goals/fleet-root-registry/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli/src/commands/Worktree/**`, `commands/Yeet/internal/Economics.ts`, `internal/repo-run/ResidueReap.ts` discovery, a new registry module, `docs/runbooks/`.
- Out: any checkout move or delete, lane creation, timer units, `standards/git-worktrees.md`. 

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
test "$(wc -m < goals/fleet-root-registry/GOAL.md)" -le 4000
jq . goals/fleet-root-registry/ops/manifest.json
git diff --check -- goals/fleet-root-registry
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
