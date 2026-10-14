# GOAL: Practice KG MCP Strict Telemetry Tier

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Shape-only telemetry for practice-kg-mcp on the attorney workstation: serializer gate, on-PC HMAC salt, encrypted spool, fail-closed tier, canary proof.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/practice-kg-mcp-strict-tier/README.md`
- `goals/practice-kg-mcp-strict-tier/SPEC.md`
- `goals/practice-kg-mcp-strict-tier/PLAN.md`
- `goals/practice-kg-mcp-strict-tier/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `apps/practice-kg-mcp` instrumentation, the shape-only `OtlpSerialization` gate and egress client (kernel extension), the encrypted spool, stderr logger, proof harness.
- Out: Collector-side redaction as the primary fence, any host install on `tom-pc-1`, hub/gateway work (fleet goal), attorney review gate (operator ruled none). See SPEC non-goals.

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
test "$(wc -m < goals/practice-kg-mcp-strict-tier/GOAL.md)" -le 4000
jq . goals/practice-kg-mcp-strict-tier/ops/manifest.json
git diff --check -- goals/practice-kg-mcp-strict-tier
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each in SPEC.md's Decision Log with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Done only when the goal reaches `completed-retained` (acceptance passes,
verification is complete, closeout and reflection landed), or when a blocker
that needs the operator is reported with file/command evidence.
