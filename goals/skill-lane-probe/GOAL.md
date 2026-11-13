# GOAL: Skill Lane Probe

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: a verdict, against the Decision Rule in `SPEC.md`, on whether loading
the `schema-first-development` skill changes Opus 5.5 lane-fraction scores on
the 12 archived SkillOpt tasks. Two cells per task, 120 fresh scored runs.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/skill-lane-probe/README.md`
- `goals/skill-lane-probe/SPEC.md`
- `goals/skill-lane-probe/PLAN.md`
- `goals/skill-lane-probe/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli/src/commands/AgentEffectiveness/`, this packet,
  harness-ledger rows for the verdict, the source exploration's map.
- Out: any optimizer or trainer, new tasks or checks, edits to the skill or to
  scorer profile v3, pilot runs as evidence, models other than Opus 5.5.

Workflow:

1. Inspect referenced files and current repo state.
2. Code first: land the report change with tests and the first slice before
   any scored run. Do not edit the Decision Rule.
3. Then the 120 scored runs, the findings and the verdict.
4. Make the smallest change that satisfies `SPEC.md`.
5. Preserve unrelated user/worktree changes.
6. Keep decisions tied to evidence from files, tests, docs, or command output.
7. Update packet evidence/status if the implementation changes readiness.
8. At the Close phase, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/skill-lane-probe/GOAL.md)" -le 4000
jq . goals/skill-lane-probe/ops/manifest.json
git diff --check -- goals/skill-lane-probe
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug skill-lane-probe` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/skill-lane-probe/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
