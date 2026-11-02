# GOAL: repo-cli gh/git consolidation

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Move repo-cli and its tests off hand-rolled gh and git spawning onto @beep/github, @beep/git and @beep/commands, extending the kits where they lack the feature. Sites: `research/site-list.md`.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/repo-cli-gh-git-consolidation/README.md`
- `goals/repo-cli-gh-git-consolidation/SPEC.md`
- `goals/repo-cli-gh-git-consolidation/PLAN.md`
- `goals/repo-cli-gh-git-consolidation/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: the sites in `research/site-list.md` (repo-cli, ai-metrics, and the scripted-spawner tests), plus the
  `@beep/github`, `@beep/git` and `@beep/commands` features they need.
- Out: the drivers effected-promotion R9 excluded; kit features no listed site needs.

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
test "$(wc -m < goals/repo-cli-gh-git-consolidation/GOAL.md)" -le 4000
jq . goals/repo-cli-gh-git-consolidation/ops/manifest.json
git diff --check -- goals/repo-cli-gh-git-consolidation
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
