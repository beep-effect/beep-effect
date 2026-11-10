# GOAL: Certainty Scorecard

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: a nightly per-head-SHA scorecard of p95 push to every required
context green on code heads (red, held, api-partial heads are misses),
runner-minutes per run, push to Yeet-mergeable beside it and the main verdict
rate; partition jobs mapped in the route corpus; attempt journals kept across
retirement and read from T3 lanes and fleet hosts. Source:
`explorations/ten-minute-certainty` (MAP goal 1).

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/certainty-scorecard/README.md`
- `goals/certainty-scorecard/SPEC.md`
- `goals/certainty-scorecard/PLAN.md`
- `goals/certainty-scorecard/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli` (Ci lane-timings, route census and corpus,
  a new certainty command; Yeet economics, attempt journal, final-check;
  Worktree residue reap; the admission journal); a new nightly workflow; the
  unit-results projection in `check.yml`; the fleet-roots runbook; tests; this
  packet.
- Out: levers that add or remove jobs on the PR or main Check path or change
  a selector (sibling goals); census shard layouts (`ci-lane-economics`); a
  budget rule of its own (`github-budget-ledger`, D27); raw journals or home
  paths in the repo; any proof-depth change.

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

- [ ] `SPEC.md` acceptance criteria are satisfied: 7 consecutive nightly
      reports with no api-partial certification, partition jobs fully mapped,
      fleet journals retained across retirement, push-to-mergeable beside
      push-to-required-green, and a "not covered" section.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/certainty-scorecard/GOAL.md)" -le 4000
jq . goals/certainty-scorecard/ops/manifest.json
git diff --check -- goals/certainty-scorecard
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug certainty-scorecard`,
then adopt with `bun run beep goals set-status certainty-scorecard <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/certainty-scorecard/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
