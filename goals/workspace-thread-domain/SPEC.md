# Workspace Thread Domain Spec

## Objective

The runtime spine's conversation model is implemented as workspace-slice
domain + persistence on local-first PGlite: Thread / Turn / Message entities
(Turn as aggregate with ordered typed items; branching as parent-turn
lineage), Drizzle tables, `db-admin` migrations proven against PGlite, a thin
`drivers/anthropic` package, the legacy `agent-capability` → `agents` slice rename,
and the epistemic-slice `UsageRecord` entity with its turn-finalization
append path.

Provenance: graduated from `explorations/agent-chat-interface` (back-links:
[`BRIEF.md`](../../explorations/agent-chat-interface/BRIEF.md),
[`DECISIONS.md`](../../explorations/agent-chat-interface/DECISIONS.md),
[`MAP.md`](../../explorations/agent-chat-interface/MAP.md)). Entity
semantics: `goals/agentic-professional-runtime/docs/data-model-shared-core.md`
(Thread, Message/Turn, Activity, UsageRecord, read models). Proof-repo
reference (read-only): `/home/elpresidank/YeeBois/projects/effect-lexical-chat/`.

## Non-Goals

- No chat UI, sidecar, or app runtime wiring — that is
  `desktop-chat-surface`.
- No event-sourced turn log: Turn aggregate + typed items; projections stay
  rebuildable.
- No sidecar Postgres and no SQLite EntityTable projection — PGlite is the
  decided local-first store.
- No ACP entities or session model.
- No candidate-state gating of thread content: turns persist as
  authoritative conversational record; proposal blocks (deferred packet)
  route through `ProposeCandidateOutputSet`.
- No standalone repo-wide rename sweep: the legacy `agent-capability` → `agents` rename happens inside
  this packet, cleanup-on-touch.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards (`standards/ARCHITECTURE.md`;
   `standards/architecture/{01,03,05,06,09,10}-*.md`).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/workspace/{domain,tables}` — Thread / Turn / Message entities
  and tables (existing packages; entities are new).
- `packages/epistemic/*` — `UsageRecord` entity (new).
- `packages/drivers/anthropic` (**new**: `@beep/anthropic`).
- legacy `packages/agent-capability/*` → `packages/agents/*` rename (+ dependent
  import updates and `goals/agentic-professional-runtime/SPEC.md`
  slice-table amendment).
- `packages/_internal/db-admin` — migrations for the new tables.

## Constraints

- Entities via `BaseEntity.Class` + persisted descriptors
  (`packages/shared/domain/src/entity/BaseEntity.ts`); table helpers:
  `packages/shared/tables/src/table/Table.ts`.
  Tables via `EntityTable.pgTableFrom` (`packages/drivers/drizzle`).
- Turn = aggregate with ordered tagged-union items
  (`Message | ToolCall | ToolResult | ArtifactRef | Activity`). Message
  content persists in the md-aligned block AST — never raw Lexical
  serialized state. Branching = parent-turn lineage; the proof's
  soft-truncate is the degenerate single-branch rendering.
- **Early task, not integration-time**: smoke-prove `db-admin` migrations
  against PGlite (`@electric-sql/pglite` 0.5.1 + `pglite-socket` 0.2.1,
  root catalog). PGlite is single-connection with a narrower extension
  surface — surface incompatibilities immediately.
- `@beep/anthropic` stays technical: acquisition Layer, ExecutionPlan
  acquisition-only retry gated on `AiError.isRetryable`, model-catalog pin
  workaround (beta.79 SSE decode rejects newer ids), `.config.ts` knobs.
  Port from proof `server/Anthropic.ts`; family pattern
  `packages/drivers/{openai-compat,venice-ai,xai}`. The driver never
  imports a slice.
- `UsageRecord` lives in the epistemic slice (runtime SPEC slice table);
  the append at turn finalization links through the turn's Activity per
  `standards/architecture/10-cross-slice-coordination.md`. OTLP metrics are
  observability-only, never the system of record. Cost from a static price
  table in driver config, marked approximate.
- Domain imports only `foundation/primitive` + `foundation/modeling`; no
  God Layers; live composition stays in `server`/app runtime.

## Acceptance Criteria

- [ ] Thread / Turn / Message entities exist in `packages/workspace/domain`
      with schema-first models, `$I` identity annotations, and tests using
      only slice Layers + shared test-kit.
- [ ] Tables + `db-admin` migrations exist and apply cleanly against PGlite
      (smoke proof recorded in `history/`).
- [ ] Thread branching (parent-turn lineage) round-trips: create thread →
      turns → edit creates branch → both branches queryable.
- [ ] `@beep/anthropic` exists with acquisition retry + model pin and no
      slice imports.
- [ ] `agents` rename complete: packages, imports, and the runtime SPEC
      slice-table amendment proposed in the same PR.
- [ ] `UsageRecord` entity + turn-finalization append path implemented with
      Activity linkage.
- [ ] Repo quality gates pass; no unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/workspace-thread-domain/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/workspace-thread-domain/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/workspace-thread-domain` | Passes |
| Quality gates | `bun run beep yeet verify` | Green |
| PGlite migration smoke | command output archived in `history/` | Migrations apply |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.
- PGlite cannot run the existing migration doctrine (extension/type gap) —
  surface with evidence; do not improvise a storage change.

## Decision Log

Inherited from `explorations/agent-chat-interface/DECISIONS.md` (2026-06-12):
workspace owns Thread/Turn/Message; Turn aggregate + typed items; thread
branching; PGlite confirmed; thin `drivers/anthropic`; UsageRecord at turn
finalization in epistemic; thread content exempt from candidate gating;
`agents` rename cleanup-on-touch.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
