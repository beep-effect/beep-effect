# GOAL: Declaration-Only Builds

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: library package builds emit declarations and declaration maps only.
The Babel pass and JavaScript emit leave the generated `beep:build`; a
package's source is type-checked once per run if the check-program census
proves build and check agree. Three PRs at most, in `PLAN.md` order.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/declaration-only-builds/README.md`
- `goals/declaration-only-builds/SPEC.md`
- `goals/declaration-only-builds/PLAN.md`
- `goals/declaration-only-builds/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: the generated-scripts policy in `@beep/repo-cli-kit`, the package
  scaffolds, `tsconfig.base.json`, `turbo.json`, the check-program census, the
  build output contract test, the effect-drizzle bundle probe (`SPEC.md`
  "Target Surfaces").
- Out: bundlers, a publish lane, a build-kit package, source-resolved
  checking, SchemaCompiler, app bundles, framework app builds.

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
test "$(wc -m < goals/declaration-only-builds/GOAL.md)" -le 4000
jq . goals/declaration-only-builds/ops/manifest.json
git diff --check -- goals/declaration-only-builds
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug declaration-only-builds` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/declaration-only-builds/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
