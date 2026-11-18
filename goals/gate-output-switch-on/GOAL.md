# GOAL: Gate Output: Switch On What Exists

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Land the six located fixes that need no new model, so agents get shorter gate output
this week: the agent signal reaches tools through Turbo, cached green tasks replay nothing under
an agent, `--help` stops reprinting global flags, lane envelopes and the monitor submit line stay
in their files, and a package-local `check` on an unbuilt tree prints one line.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/gate-output-switch-on/README.md`
- `goals/gate-output-switch-on/SPEC.md`
- `goals/gate-output-switch-on/PLAN.md`
- `goals/gate-output-switch-on/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `turbo.json`, `standards/cache-baseline/`, `@beep/runtime-env` agent table, `@beep/cli-kit`
  `CliColor`, and in `@beep/repo-cli` `Quality/Tasks.ts`, `Quality/CheckCensus.ts`,
  `Yeet/internal/IssueArtifacts.ts`, `bin-main.ts`, the package-script generator, and their tests.
- Out: the gate-report model, renderer, history and CI projection (sibling goals), a gate-table
  delta mode, wrappers around commands the repo does not own, MCP tools or hooks. See `SPEC.md`
  Non-Goals.

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
test "$(wc -m < goals/gate-output-switch-on/GOAL.md)" -le 4000
jq . goals/gate-output-switch-on/ops/manifest.json
git diff --check -- goals/gate-output-switch-on
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug gate-output-switch-on` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/gate-output-switch-on/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
