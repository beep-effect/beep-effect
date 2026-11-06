# GOAL: Remove Python from the repo, port photo-face to onnxruntime-node, and ban Python in tracked source

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Remove Python from the repo, port photo-face to onnxruntime-node, and ban Python in tracked source (graduated from explorations/pulumi-to-alchemy).

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/python-free-repo/README.md`
- `goals/python-free-repo/SPEC.md`
- `goals/python-free-repo/PLAN.md`
- `goals/python-free-repo/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: every tracked *.py (port or delete per the triage table), packages/tooling/tool/cli Files commands (photo-face port over onnxruntime-node), .claude/skills scripts, lint laws + lefthook + cheap-tier CI check, AGENTS.md Code Laws line.
- Out: infra/r2-cache Python (deleted by infra-alchemy-rebuild), shell scripts (scripts-to-beep-cli), model files and checksums, agents' out-of-repo scratch.

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
test "$(wc -m < goals/python-free-repo/GOAL.md)" -le 4000
jq . goals/python-free-repo/ops/manifest.json
git diff --check -- goals/python-free-repo
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug python-free-repo`,
then adopt with `bun run beep goals set-status python-free-repo <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/python-free-repo/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
