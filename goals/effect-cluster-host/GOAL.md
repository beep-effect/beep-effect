# GOAL: Effect Cluster Host

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Make Effect Cluster on Postgres a host the monorepo can run a slice on: Alchemy beta.87, the library fixes as root patches, the conformance suite as a package, a local swarm recipe.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/effect-cluster-host/README.md`
- `goals/effect-cluster-host/SPEC.md`
- `goals/effect-cluster-host/PLAN.md`
- `goals/effect-cluster-host/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: the root `package.json`, `patches/`, `bun.lock`, a new conformance package, a local swarm recipe with a runbook, deployment descriptors and generated entry modules for one app pool, and `packages/drivers/alchemy-postgres` or `packages/documents` only as the beta.87 bump requires.
- Out: retiring `@beep/alchemy-postgres`, cloud deployment, building a context, posting anything upstream without the operator's say-so. See `SPEC.md` Non-Goals.

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
test "$(wc -m < goals/effect-cluster-host/GOAL.md)" -le 4000
jq . goals/effect-cluster-host/ops/manifest.json
git diff --check -- goals/effect-cluster-host
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug effect-cluster-host` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/effect-cluster-host/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
