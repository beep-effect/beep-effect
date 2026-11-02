# GOAL: beep CLI composition

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Split @beep/repo-cli into apps/beep over beep-* command tools and repo-* libraries, after the gate fixes land

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/beep-cli-composition/README.md`
- `goals/beep-cli-composition/SPEC.md`
- `goals/beep-cli-composition/PLAN.md`
- `goals/beep-cli-composition/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli` and everything it splits into (see
  `SPEC.md` Target Surfaces), the root wiring those moves touch, and the
  doctrine text in `standards/`.
- Out: command behaviour changes beyond D11, substrate owned by
  `goals/effected-promotion`, and renames of the ten grandfathered tooling
  packages. Start from the next pending row of the PLAN wave sequence.

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
test "$(wc -m < goals/beep-cli-composition/GOAL.md)" -le 4000
jq . goals/beep-cli-composition/ops/manifest.json
git diff --check -- goals/beep-cli-composition
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each in SPEC.md's Decision Log with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final implementation PR while
initiative.status stays active or paused. A proposal never reports achievement.
Done only when exact-head hosted readiness and merge evidence verify the proposal
through `bun run beep goals completion refresh --slug <slug>`, or when a blocker
that needs the operator is reported with file/command evidence.
