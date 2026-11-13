# GOAL: Main Verdict Every Commit

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the prerequisites for a per-commit main verdict and a higher interim
rate. No agent cancels a main run, main pushes run a throughput layout with a
published replay, and missing verdicts are re-dispatched. The per-commit
verdict itself is the merge-group run (merge-queue-activation, D28).

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/main-verdict-every-commit/README.md`
- `goals/main-verdict-every-commit/SPEC.md`
- `goals/main-verdict-every-commit/PLAN.md`
- `goals/main-verdict-every-commit/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: the AGENTS.md "Inherited reds" clause and the orchestrate skill (cancel
  ban); the push branch of the Test Plan job in `.github/workflows/check.yml`;
  `.github/workflows/rerun-runner-loss.yml` (a re-dispatch job);
  `packages/tooling/tool/cli` Ci commands (partitions, re-dispatch, replay);
  this packet.
- Out: the scorecard (certainty-scorecard); PR partition tables
  (ci-lane-economics); the runner-loss classifier and its workflow list
  (yeet-monitor-app-identity); heavy-pool capacity (money); per-SHA groups,
  merge queue and merge doctrine (github-merge-queue); any proof-depth change.

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

- [ ] `SPEC.md` acceptance criteria are satisfied: PR first-wave pickup p95
      and heavy-wait p95 up by at most 1 min, zero agent main cancels, the
      replay published, the verdict rate reported against the 95% bar.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/main-verdict-every-commit/GOAL.md)" -le 4000
jq . goals/main-verdict-every-commit/ops/manifest.json
git diff --check -- goals/main-verdict-every-commit
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug main-verdict-every-commit` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/main-verdict-every-commit/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
