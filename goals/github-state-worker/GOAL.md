# GOAL: GitHub State Worker

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: one GitHub reader per host. A systemd user worker (ObservationWorker
template, LoadCredential token) reads the tracked PR set with fingerprint
GraphQL and ETag REST, writes atomic PR snapshots, and monitor, ready,
merge-gate, --watch, gate-table, the orchestrator watchers and
`beep yeet status --cached` read them, falling back to direct reads.
Proven by a before/after from the github-budget-ledger goal.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/github-state-worker/README.md`
- `goals/github-state-worker/SPEC.md`
- `goals/github-state-worker/PLAN.md`
- `goals/github-state-worker/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/drivers/github` (ETag fetch layer, GraphQL documents);
  `packages/tooling/tool/cli` (worker, snapshot, Yeet readers, status
  --cached, GraphqlBudget reserve gating); repo-cli-kit `SystemdUnit.ts` if
  needed; `.claude/skills/{yeet,orchestrate}`; this packet.
- Out: the ledger and parcel (github-budget-ledger), App identity and
  rerun-runner-loss.yml (yeet-monitor-app-identity), webhooks, fleet-wide
  state, t3code, merge queue, gh PATH shims, weaker merge evidence.
- Needs: github-budget-ledger's reserve signal and ledger (`requires`).

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
test "$(wc -m < goals/github-state-worker/GOAL.md)" -le 4000
jq . goals/github-state-worker/ops/manifest.json
git diff --check -- goals/github-state-worker
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug github-state-worker`,
then adopt with `bun run beep goals set-status github-state-worker <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/github-state-worker/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
