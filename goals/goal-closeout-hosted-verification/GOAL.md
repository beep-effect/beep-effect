# GOAL: Goal Closeout Hosted Verification

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Verify goal completion from hosted GitHub facts after the merge, close goals in one PR, and stop goals-only finals from running unrelated coverage

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/goal-closeout-hosted-verification/README.md`
- `goals/goal-closeout-hosted-verification/SPEC.md`
- `goals/goal-closeout-hosted-verification/PLAN.md`
- `goals/goal-closeout-hosted-verification/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `@beep/repo-cli` goals completion, set-status, decisions, doctor,
  closeout check, session view and the `yeet sweep --retire` trigger, with
  their tests; the `AGENTS.md` closeout bullet; the closeout, reflect and
  sweep-retire skill text; `goals/README.md` and `goals/_template/`; the
  migration packets; every active or paused GOAL.md and PLAN.md closeout step.
  PR B: the final-check coverage planner (`SPEC.md` Target Surfaces).
- Out: archived tombstones, completed packet launchers, the Codex packet
  generators, a hosted online doctor job or new workflow, `@beep/github`,
  `apps/labs/lane-cockpit`, and the declared `yeet-verdict` refs
  (`SPEC.md` Non-Goals).

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
test "$(wc -m < goals/goal-closeout-hosted-verification/GOAL.md)" -le 4000
jq . goals/goal-closeout-hosted-verification/ops/manifest.json
git diff --check -- goals/goal-closeout-hosted-verification
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug goal-closeout-hosted-verification` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/goal-closeout-hosted-verification/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
