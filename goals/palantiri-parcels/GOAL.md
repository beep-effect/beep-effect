# GOAL: Palantiri Parcels

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Agent-facing Palantiri: schema-typed, freshness-checked parcels served through beep palantiri and palantiri-mcp, starting with account headroom.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/palantiri-parcels/README.md`
- `goals/palantiri-parcels/SPEC.md`
- `goals/palantiri-parcels/PLAN.md`
- `goals/palantiri-parcels/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/tooling/library/palantiri/**` (parcel schemas + `Parcels` service), `packages/tooling/tool/palantiri-mcp/**` (MCP host), `packages/tooling/tool/cli/src/commands/Palantiri/**` (CLI group), `beep session open` integration, the quota gauge emitter over `AccountsUsage`.
- Out: Backend/store choice, parcel-gated yeet actions (gated re-entry), the strict tier, harness wrappers. See SPEC non-goals.

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
test "$(wc -m < goals/palantiri-parcels/GOAL.md)" -le 4000
jq . goals/palantiri-parcels/ops/manifest.json
git diff --check -- goals/palantiri-parcels
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
