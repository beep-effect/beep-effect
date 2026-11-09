# GOAL: T3 Code Harness MCP

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Register a user-scope `t3-code` entry against each host's own T3 in every harness that runs outside T3 on every live host, prove T3-launched sessions do not double-load it, and remind before the 180-day tokens and links expire.

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

- In: Register `t3-code` (each host's own T3, per-harness Full-access OAuth token) in Claude Code, Codex, Grok, cursor-agent and Junie on every live host; prove T3-launched sessions do not double-load it; a renewal reminder for the 180-day tokens and links; per-harness recipe in the runbook.
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

Closed in one PR by operator ruling (decision `single-pr-closeout`), replacing the
usual two-PR closeout. After that merge, the lane owner verifies with
`bun run beep goals completion refresh --slug t3code-harness-mcp` and opens a packet-state PR
reopening the packet unless the outcome is verified. Check:
`git show origin/main:goals/t3code-harness-mcp/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
