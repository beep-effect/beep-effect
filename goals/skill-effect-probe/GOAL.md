# GOAL: Skill Effect Probe

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: a verdict, against the decision rule in `SPEC.md`, on whether loading
the `schema-first-development` skill changes Opus 5.5 output on the 12 archived
SkillOpt tasks. Three cells per task, about 180 scored runs.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/skill-effect-probe/README.md`
- `goals/skill-effect-probe/SPEC.md`
- `goals/skill-effect-probe/PLAN.md`
- `goals/skill-effect-probe/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli/src/commands/AgentEffectiveness/`, this packet,
  harness-ledger rows for the verdict, the source exploration's map if a gate
  fires.
- Out: any optimizer or trainer, new tasks, edits to the skill under test,
  models other than Opus 5.5, automatic pruning.

Workflow:

1. Inspect referenced files and current repo state.
2. P0 first: one task, three cells, two runs, scored end to end. Stop and
   report if a kept run cannot be tied to its case, cell and run.
3. Commit the analysis rule before any scored run record.
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
test "$(wc -m < goals/skill-effect-probe/GOAL.md)" -le 4000
jq . goals/skill-effect-probe/ops/manifest.json
git diff --check -- goals/skill-effect-probe
bun run beep quality package-verify @beep/repo-cli
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug skill-effect-probe`,
then adopt with `bun run beep goals set-status skill-effect-probe <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/skill-effect-probe/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
