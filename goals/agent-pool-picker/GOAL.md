# GOAL: print the lane command the pool doctrine implies

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `bun run beep agent-pool pick [--tier volume|review|mechanical] [--json]`
reads the Codex meter through the app-server protocol, applies the floors from
`AGENTS.md` "Volume pools", and prints the exact `codex exec` or
`cursor-agent -p` command, or `hold` with reasons.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/agent-pool-picker/README.md`
- `goals/agent-pool-picker/SPEC.md`
- `goals/agent-pool-picker/PLAN.md`
- `goals/agent-pool-picker/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, `docs/runbooks/agent-pools.md`,
and `goals/agent-pool-doctrine/SPEC.md`. This packet is paused until Goal A
merges; do not start it while `initiative.status` is `paused`.

Scope:

- In: `packages/tooling/tool/cli/src/commands/AgentPool/**`, its tests, the
  dry-marker contract in the runbook, this packet.
- Out: Cursor private endpoints; seat map or floor changes; launching lanes.

Workflow:

1. Schema first (`PoolSnapshot`, `Tier`, `Seat`, `LaneCommand`), then the
   `Context.Service` contract for `CodexMeter`, then implementation.
2. Fixtures recorded from `account/rateLimits/read`; deterministic decisions.
3. Preserve unrelated worktree changes; keep the CLI command layout.
4. At P4 Close, write the closeout reflection via `/reflect`.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] `bun run beep quality package-verify @beep/repo-cli` passes.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
bun run beep quality package-verify @beep/repo-cli
test "$(wc -m < goals/agent-pool-picker/GOAL.md)" -le 4000
jq . goals/agent-pool-picker/ops/manifest.json
```

Stop and report before changing public API, dependencies, lockfiles, or
generated files unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
