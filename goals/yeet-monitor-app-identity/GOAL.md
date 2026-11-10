# GOAL: Yeet Monitor App Identity

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the Yeet monitor never writes to GitHub (environment-only reruns
move to `rerun-runner-loss.yml` on `GITHUB_TOKEN`), and the per-host
GitHub-state worker reads on the beep-fleet-orchestrator App installation token
from `LoadCredential=`. Ledger evidence shows polling load moved from the user
bucket to the App bucket. 3a starts after `github-budget-ledger` and may run
alongside `github-state-worker`; 3b needs that worker and 3a merged.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/yeet-monitor-app-identity/README.md`
- `goals/yeet-monitor-app-identity/SPEC.md`
- `goals/yeet-monitor-app-identity/PLAN.md`
- `goals/yeet-monitor-app-identity/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `.github/workflows/rerun-runner-loss.yml`; `commands/Ci/RunnerLossRerun.ts`,
  `CiRerunRunnerLoss.ts`, `internal/github/JobShape.ts` and
  `commands/Yeet/internal/MonitorLoop.ts` in `packages/tooling/tool/cli`; the
  worker's credential and identity wiring; `SystemdUnit.ts` in `repo-cli-kit`
  if needed; the runner-reliability runbook and skill references; the ruling
  reversal decision and ledger evidence in `history/`.
- Out: new Apps or tokens; tokens in env or argv; App identity for merges,
  replies or operator commands; the ledger, snapshot store, ETag layer and
  readers (sibling goals); webhooks, fleet sharing, t3code, merge queue.

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
test "$(wc -m < goals/yeet-monitor-app-identity/GOAL.md)" -le 4000
jq . goals/yeet-monitor-app-identity/ops/manifest.json
git diff --check -- goals/yeet-monitor-app-identity
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug yeet-monitor-app-identity`,
then adopt with `bun run beep goals set-status yeet-monitor-app-identity <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/yeet-monitor-app-identity/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
