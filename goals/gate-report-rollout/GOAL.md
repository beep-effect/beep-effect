# GOAL: Gate Report Rollout

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: every gate the repo owns writes a gate report and prints its bounded
console; Yeet's verdict, issue index and lane reports read gate reports, never
streams; long gates print a heartbeat; the gate table, `job wait` and the
readiness monitor block until state changes and print only what changed.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/gate-report-rollout/README.md`
- `goals/gate-report-rollout/SPEC.md`
- `goals/gate-report-rollout/PLAN.md`
- `goals/gate-report-rollout/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict. Blocked on `goals/gate-report-core` for P1 onward.

Scope:

- In: the lane catalog and adapters (`Quality/`, `Ci/CiLane.ts`, `Lint/`,
  `Laws/`, `Docgen/`), `package-verify`, Yeet `final-check`, verdict, issue
  index, gate table, job wait and monitor, `AGENTS.md`, the yeet and
  orchestrate skills.
- Out: the report model and renderer, `test`/`check` wiring, history labels,
  CI projection, the five switch-on fixes. See `SPEC.md` Non-Goals.

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
test "$(wc -m < goals/gate-report-rollout/GOAL.md)" -le 4000
jq . goals/gate-report-rollout/ops/manifest.json
git diff --check -- goals/gate-report-rollout
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug gate-report-rollout` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/gate-report-rollout/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
