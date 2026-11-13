# GOAL: GitHub Budget Ledger

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: every GitHub request made by repo tooling lands in a host-scoped
ledger (identity x resource x command x host) from `x-ratelimit-*` headers and
the free `GET /rate_limit`; `bun run beep session open` shows a
`github-headroom` parcel; the ledger publishes the 15% reserve signal per identity x resource; a 24 h
hub baseline and the T3 share threshold are recorded. Source:
`explorations/github-api-quota` (MAP goal 1).

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/github-budget-ledger/README.md`
- `goals/github-budget-ledger/SPEC.md`
- `goals/github-budget-ledger/PLAN.md`
- `goals/github-budget-ledger/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/drivers/github` (`internal/octokit.ts` rate-limit capture,
  `Resilience.ts`); `packages/tooling/tool/cli` (ledger module, `/rate_limit`
  sampler via `MonitorRateLimit.ts`, `GraphqlBudget.ts`, `gh` attribution in
  `GhCommand.ts` and `internal/repo-run`, Palantiri producer, session open);
  `packages/tooling/library/palantiri` (`github-headroom` parcel); tests; this
  packet.
- Out: the per-host worker, ETag layer and snapshot readers (goal
  `github-state-worker`); App identity and rerun widening (goal
  `yeet-monitor-app-identity`); a `gh` PATH shim; cross-host state; webhooks;
  t3code fork changes; tokens in env, argv or ledger rows.

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
test "$(wc -m < goals/github-budget-ledger/GOAL.md)" -le 4000
jq . goals/github-budget-ledger/ops/manifest.json
git diff --check -- goals/github-budget-ledger
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug github-budget-ledger` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/github-budget-ledger/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
