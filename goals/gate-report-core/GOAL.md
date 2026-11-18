# GOAL: Gate Report Core

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: one gate-neutral report model (gate, unit, item) and one console renderer, ported from vitest-agent's core into `@beep/*` packages with attribution, proven on `test` and `check`: verdict first and last, silent on success, bounded failures, record and raw log under `.beep/gates/`, a Turbo cache hit rendering the same console.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/gate-report-core/README.md`
- `goals/gate-report-core/SPEC.md`
- `goals/gate-report-core/PLAN.md`
- `goals/gate-report-core/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: new packages `@beep/gate-report` (foundation/modeling), `@beep/repo-gate-run` (tooling/library) and a Vitest adapter (tooling/test-kit), all via `bun run beep create-package` (names confirmed in P0); `vitest.shared.ts`; the `test` and `check` tasks in `turbo.json`; `Quality/Tasks.ts`; the diagnostic pattern in `Yeet/internal/IssueParser.ts`; a new `Gate` command directory of the repo CLI.
- Out: history labels and the delta (`goals/gate-run-history`), other gates and Yeet consumers (`goals/gate-report-rollout`), the CI projection (`goals/ci-gate-reports`), the TDD workflow, Ink view, hooks, sidecar and MCP server, SARIF and CTRF emitters. See `SPEC.md` Non-Goals.

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
test "$(wc -m < goals/gate-report-core/GOAL.md)" -le 4000
jq . goals/gate-report-core/ops/manifest.json
git diff --check -- goals/gate-report-core
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug gate-report-core` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/gate-report-core/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
