# GOAL: Route Soundness Repair

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: every confirmed missed-red path has a mutation fixture that goes red
(goal-data consumers, docs/goals knowledge policy, `@beep/glob` setup closure,
bare-coverage self-judge, final-check receipt versioning, Node coverage
runtime), and the classifier differential reports zero unadmitted
disagreements. Source: `explorations/ten-minute-certainty` (MAP goal 2).

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/route-soundness-repair/README.md`
- `goals/route-soundness-repair/SPEC.md`
- `goals/route-soundness-repair/PLAN.md`
- `goals/route-soundness-repair/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli` (Ci, Quality and Yeet final-check
  commands) and tests; `turbo.json` test inputs;
  `.github/workflows/check.yml` and the other change-profile callers
  (heavy.yml, heavy-admit.yml, storybook.yml; PERIH-10);
  `scripts/cloud/bootstrap.sh` (COVE-03);
  `standards/cache-qualification-baseline.json` and
  `standards/policy-tools.fingerprint.json` (TEST-10 re-record and reseal); AGENTS.md and yeet skill gate names; this
  packet. Levers: ROUT-03, ROUT-02, TEST-10, COVE-02, YEET-08, COVE-03,
  COVE-08, COVE-04, PERIH-10, ROUT-07.
- Out: any narrowing or skip lever (other goals); proof-depth cuts; the
  coverage-rollout probe deletion and pin bumps (heavy-pool-diet); the advisory
  ratchet COVE-01 (local-proof-under-ten); making Coverage Regression required.

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
- [ ] ROUT-03 slice 1 merged by 2026-11-16, or the #2999 regex rolled back.
- [ ] Each repair merged with its mutation fixture or replay.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/route-soundness-repair/GOAL.md)" -le 4000
jq . goals/route-soundness-repair/ops/manifest.json
git diff --check -- goals/route-soundness-repair
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug route-soundness-repair` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/route-soundness-repair/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
