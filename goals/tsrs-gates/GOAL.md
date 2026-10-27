# GOAL: Run the typecheck and build gates on the Effect-patched tsrs

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Replace tsc-rs with the Effect-patched tsrs that @effect/tsgo 0.59.0 ships, so one compiler gates TypeScript errors and every Effect rule, and the standalone Effect Diagnostics lane can fold into Check.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/tsrs-gates/README.md`
- `goals/tsrs-gates/SPEC.md`
- `goals/tsrs-gates/PLAN.md`
- `goals/tsrs-gates/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: root manifest and lockfile, syncpack, the backup pruner, every workspace
  manifest's typecheck/build scripts, repo-cli scaffold defaults and compiler
  parsers with their tests, the repo-configs policy test, the cache baseline,
  the toolchain runbook and the AGENTS.md Touch row.
- Out: the standalone Effect Diagnostics lane and the ignore flags (PR 2),
  editors and the tsgo-only quality lanes, `--fast`, the proxy command.

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
test "$(wc -m < goals/tsrs-gates/GOAL.md)" -le 4000
jq . goals/tsrs-gates/ops/manifest.json
git diff --check -- goals/tsrs-gates
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each in SPEC.md's Decision Log with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final implementation PR while
initiative.status stays active or paused. A proposal never reports achievement.
Done only when exact-head hosted readiness and merge evidence verify the proposal
through `bun run beep goals completion refresh --slug <slug>`, or when a blocker
that needs the operator is reported with file/command evidence.
