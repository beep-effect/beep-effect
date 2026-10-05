# GOAL: ai-metrics raw retention

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `~/.local/state/beep/ai-metrics/raw` (22 GB, 97% older than 30 days) is compacted or offloaded by age on a timer rendered on the ops seat, with `derived` proven reproducible from raw first.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/ai-metrics-raw-retention/README.md`
- `goals/ai-metrics-raw-retention/SPEC.md`
- `goals/ai-metrics-raw-retention/PLAN.md`
- `goals/ai-metrics-raw-retention/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/tooling/library/ai-metrics/**`, one timer renderer, `docs/runbooks/`.
- Out: raw deletion, data-root relocation, forwarder or redaction changes. 

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill (see
   `PLAN.md` P4 Closeout Checklist); `bun run beep lint reflection-artifacts`
   must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/ai-metrics-raw-retention/GOAL.md)" -le 4000
jq . goals/ai-metrics-raw-retention/ops/manifest.json
git diff --check -- goals/ai-metrics-raw-retention
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
