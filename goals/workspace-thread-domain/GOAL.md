# GOAL: implement the workspace thread domain on PGlite

Repo: this `beep-effect` checkout.

Outcome: Thread/Turn/Message entities + tables exist in the workspace slice
with migrations proven against PGlite; `@beep/anthropic` driver exists; the
legacy `agent-capability` → `agents` rename is complete; the epistemic `UsageRecord`
entity + turn-finalization append path is implemented.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/workspace-thread-domain/README.md`
- `goals/workspace-thread-domain/SPEC.md`
- `goals/workspace-thread-domain/PLAN.md`
- `goals/workspace-thread-domain/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and standards named by
`SPEC.md` (esp. `standards/architecture/{03,10}-*.md`). Entity semantics:
`goals/agentic-professional-runtime/docs/data-model-shared-core.md`.
Proof-repo reference (read-only):
the effect-lexical-chat project's `server/Anthropic.ts` (machine-local checkout).

Scope:

- In: `packages/workspace/{domain,tables}`, `packages/epistemic/*`
  (UsageRecord), `packages/drivers/anthropic` (new),
  legacy `packages/agent-capability/*` → `packages/agents/*` (+ imports + runtime
  SPEC slice-table amendment), `packages/_internal/db-admin`.
- Out: chat UI/sidecar/app wiring; event-sourced turns; SQLite/sidecar
  Postgres; ACP entities; candidate gating of thread content.

Key constraints (SPEC.md is normative):

- `BaseEntity.Class` + persisted descriptors; tables via
  `EntityTable.pgTableFrom`; pattern: Organization model/table in
  `packages/shared/{domain,tables}`.
- Turn = aggregate with ordered typed items
  (Message|ToolCall|ToolResult|ArtifactRef|Activity); Message content in the
  md-aligned AST, never raw Lexical state; branching = parent-turn lineage.
- **Early task**: smoke-prove db-admin migrations against PGlite
  (single-connection; narrower extensions). Stop with evidence if doctrine
  can't run on it.
- `@beep/anthropic`: acquisition-only ExecutionPlan retry, model-catalog
  pin, technical config; never imports a slice.
- UsageRecord in epistemic, linked via the turn's Activity; OTLP is never
  the system of record.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At P3 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/workspace-thread-domain/GOAL.md)" -le 4000
jq . goals/workspace-thread-domain/ops/manifest.json
git diff --check -- goals/workspace-thread-domain
bun run beep yeet verify
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
