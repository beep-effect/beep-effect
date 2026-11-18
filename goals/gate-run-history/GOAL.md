# GOAL: Gate Run History

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: every gate report recorded by branch in one SQLite file per repository; each failure labelled introduced on this lane, red on main, persistent or flaky from the lane's own runs and main's hosted results; a fix-loop delta on every re-run; a store failure never hides the verdict.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/gate-run-history/README.md`
- `goals/gate-run-history/SPEC.md`
- `goals/gate-run-history/PLAN.md`
- `goals/gate-run-history/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: the history store, classifier and delta in the gate-report model and gate-run library that `goals/gate-report-core` creates; `Quality/Tasks.ts` ingestion after render; the history queries and baseline import of the planned `gate` command family; recording flake-quarantine incidents. Starts once `goals/gate-report-core` lands; P4 also waits on `goals/ci-gate-reports`.
- Out: the report model and console (core), the hosted-report carrier and upload (`goals/ci-gate-reports`), flake-quarantine detection rules, coverage trends and upstream's TDD tables. See `SPEC.md` Non-Goals.

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
test "$(wc -m < goals/gate-run-history/GOAL.md)" -le 4000
jq . goals/gate-run-history/ops/manifest.json
git diff --check -- goals/gate-run-history
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug gate-run-history` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/gate-run-history/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
