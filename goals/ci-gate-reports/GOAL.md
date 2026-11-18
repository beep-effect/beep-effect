# GOAL: CI Gate Reports

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: every hosted gate job renders its step summary and grouped log from
gate reports and uploads them; a lane can fetch main's newest reports for its
merge base; one command prints a failing job's verdict and isolated failing
region by run or PR number, with no `head` or `grep`.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/ci-gate-reports/README.md`
- `goals/ci-gate-reports/SPEC.md`
- `goals/ci-gate-reports/PLAN.md`
- `goals/ci-gate-reports/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict. Blocked on `goals/gate-report-core` for P1 onward.

Scope:

- In: the gate workflows under `.github/workflows/`, the `Ci/` commands of
  `@beep/repo-cli`, the log route in `Yeet/internal/MonitorLoop.ts`, the CI
  projection, the report upload and lookup, the CI-job adapter, the yeet
  skill's `gh-rest.md` and the `AGENTS.md` log-read line.
- Out: the report model, local gate rollout, history labels, SARIF upload,
  MCP tools and hooks. See `SPEC.md` Non-Goals.

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
test "$(wc -m < goals/ci-gate-reports/GOAL.md)" -le 4000
jq . goals/ci-gate-reports/ops/manifest.json
git diff --check -- goals/ci-gate-reports
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug ci-gate-reports` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/ci-gate-reports/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
