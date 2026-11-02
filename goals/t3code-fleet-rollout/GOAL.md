# GOAL: T3 Code Fleet Rollout

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Run the fork build of T3 Code as a tailnet-only systemd service on every live worker host, distributed by a DankStation publish and a hash-verified host pull, linked hub-and-spoke to DankStation.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/t3code-fleet-rollout/README.md`
- `goals/t3code-fleet-rollout/SPEC.md`
- `goals/t3code-fleet-rollout/PLAN.md`
- `goals/t3code-fleet-rollout/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: DankStation fork sync gains pack+publish; per-host pull timer and `t3 service` on beep-worker, dankserver, tom-pc-1 (new WSL distro); Tailscale HTTPS; hub-and-spoke Linked environments; host runbook and `remote-development-agents` host profiles.
- Out: tbk-worker until the operator releases its latch; grok-bot-box-1; Hyper-V; Funnel/T3 Connect; harness MCP registration; spill rule; copying credentials between hosts.

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
test "$(wc -m < goals/t3code-fleet-rollout/GOAL.md)" -le 4000
jq . goals/t3code-fleet-rollout/ops/manifest.json
git diff --check -- goals/t3code-fleet-rollout
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
