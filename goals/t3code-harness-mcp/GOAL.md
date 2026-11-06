# GOAL: T3 Code Harness MCP

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Register `t3-hub` (the DankStation T3 environment, Full-access OAuth) in every harness that runs outside T3 on every live host, prove T3-launched sessions do not double-load it, and remind before the 30-day grants and links expire.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/t3code-harness-mcp/README.md`
- `goals/t3code-harness-mcp/SPEC.md`
- `goals/t3code-harness-mcp/PLAN.md`
- `goals/t3code-harness-mcp/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: Register `t3-hub` (DankStation environment, Full-access OAuth over Tailscale HTTPS) in Claude Code, Codex, Grok, cursor-agent and Junie on every live host; prove T3-launched sessions do not double-load it; renewal reminders for 30-day grants and links; per-harness recipe in the runbook.
- Out: A repo-owned config writer (`agent-config-canonicalization`); host installs; per-environment grants; other MCP servers' config.

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
test "$(wc -m < goals/t3code-harness-mcp/GOAL.md)" -le 4000
jq . goals/t3code-harness-mcp/ops/manifest.json
git diff --check -- goals/t3code-harness-mcp
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each in SPEC.md's Decision Log with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug t3code-harness-mcp`,
then adopt with `bun run beep goals set-status t3code-harness-mcp <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/t3code-harness-mcp/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
