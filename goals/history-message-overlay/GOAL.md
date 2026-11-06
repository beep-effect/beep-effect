# GOAL: History Message Overlay

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the July commit-message map is tracked at
`docs/history/commit-message-map.json` and projected by `beep history notes`
into `refs/notes/history`, shown in every clone's `git log`; no SHA changes
(graduated from explorations/git-history-rewrite).

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/history-message-overlay/README.md`
- `goals/history-message-overlay/SPEC.md`
- `goals/history-message-overlay/PLAN.md`
- `goals/history-message-overlay/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `docs/history/`, `@beep/git` notes ops, `@beep/repo-cli` History
  command + `worktree new` hook, `scripts/cloud/bootstrap.sh`, one post-merge
  workflow, retiring `~/YeeBois/projects/beep-effect-cutover`.
- Out: any history rewrite, filter-repo or force-push; editing commit
  messages, signatures or SHAs; workstation pushes of the notes ref.

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
test "$(wc -m < goals/history-message-overlay/GOAL.md)" -le 4000
jq . goals/history-message-overlay/ops/manifest.json
git diff --check -- goals/history-message-overlay
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug history-message-overlay`,
then adopt with `bun run beep goals set-status history-message-overlay <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/history-message-overlay/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
