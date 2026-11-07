# GOAL: Execution Authority Slice

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: agent execution authority (grants, verdicts, the hash-chained decision
ledger, the governed gate and egress, and their config) lives in a new
`execution-authority` slice with unchanged behavior (P1). Each ontology Session
change then links to the decision that authorized it (P2).

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/execution-authority-slice/README.md`
- `goals/execution-authority-slice/SPEC.md`
- `goals/execution-authority-slice/PLAN.md`
- `goals/execution-authority-slice/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/execution-authority/*` (new), the execution modules in
  `packages/epistemic/*`, `packages/_internal/db-admin`,
  `apps/professional-desktop`, tooling pins, and (P2) the ontology Session
  journal. The full list is SPEC "Target Surfaces".
- Out: hash labels and bytes, tip anchoring, foundation extraction, re-export
  shims, and the epistemic slice's claim, edge and retention code.

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
test "$(wc -m < goals/execution-authority-slice/GOAL.md)" -le 4000
jq . goals/execution-authority-slice/ops/manifest.json
git diff --check -- goals/execution-authority-slice
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug execution-authority-slice`,
then adopt with `bun run beep goals set-status execution-authority-slice <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/execution-authority-slice/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
