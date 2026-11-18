# GOAL: Authority Context

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Build authority as the first four-package slice: Invocation and grant-check language, grants, narrowing delegation, accountability, admission and re-admission, on Effect Cluster.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/authority-context/README.md`
- `goals/authority-context/SPEC.md`
- `goals/authority-context/PLAN.md`
- `goals/authority-context/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/authority/{contract,model,host}` (new), the kernel schemas and grant-check language in the shared kernel package the standard names, one test consumer model, this context's deployment descriptors, conformance case and proof inventory entries.
- Out: moving `packages/execution-authority`, `AgentRun` and budgets, a `web` package, gateway tokens between pools, changing existing slices to call authority. See `SPEC.md` Non-Goals.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At the Close phase, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/authority-context/GOAL.md)" -le 4000
jq . goals/authority-context/ops/manifest.json
git diff --check -- goals/authority-context
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug authority-context` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/authority-context/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
