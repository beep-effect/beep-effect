# Decisions

## 2026-06-12 — context alignment confirmed

**Question:** Does the assistant's summary of the stack and the brainstorm
intent match the author's mental model (before align-stage grilling begins)?

**Answer:** Yes — fully aligned.

**Rationale:** The confirmed framing, carried into all later stages:

1. The chat input is the control plane's **command surface** — schema-parsed
   blocks let the runtime deterministically route intent (prose vs artifact
   references vs slash commands vs approval actions), not just prettier text.
2. Editing a message = **thread branching**, which the Thread doctrine in
   `goals/agentic-professional-runtime/docs/data-model-shared-core.md`
   anticipates; Lexical's immutable EditorState is the natural substrate.
3. Blocks as Effect Schema tagged unions + annotations → per-model
   serialization (e.g. XML for Claude) via existing `@beep/schema` codecs.
4. Likely placement per repo law: generic editor/chat kit extends `@beep/ui`
   editor blocks; Thread/Turn schemas land in the workspace domain; desktop
   wiring follows the existing Atom + SDK-contract patterns.

Align-stage grilling has not started; open questions live in
[`ops/manifest.json`](./ops/manifest.json).

## 2026-06-12 — handoff-locked decisions (prior grill session)

Decided with the author in a grill-with-docs session grounded in the runtime
SPEC, the architecture standard, and repo precedents; carried in via
`handoff-agent-chat-exploration.md` from the effect-lexical-chat proof repo (machine-local checkout).
Re-open only on contradicting code/doctrine evidence (surface as drift).

1. **Thread/Turn/Message ownership: the `workspace` slice.** Matches the
   runtime SPEC slice table (`goals/agentic-professional-runtime/SPEC.md` —
   "workspaces, threads, messages, artifacts…"). The agents slice owns only
   model/provider bindings and the turn-generation kernel.
2. **Rename `agent-capability` → `agents`.** "Capability" collides with the
   `foundation/capability` kind vocabulary, so the slice name reads as a
   non-slice family. Propose the runtime SPEC.md slice-table amendment;
   **execute** the rename as an early task inside the graduated goals packet
   (cleanup-on-touch), not a standalone sweep.
3. **Database: lean PGlite** (`@electric-sql/pglite` + `pglite-socket`).
   Confirmed below (entry: *PGlite confirmed*).
4. **Edit semantics: thread branching**, per the Thread doctrine
   (`data-model-shared-core.md`: "branching, replay, and sub-agent lineage
   matter"). The proof's soft-truncate (`superseded_at` + filtered view)
   becomes the degenerate single-branch rendering. The streaming kernel ports
   unchanged; only persistence shape differs.
5. **Scope: full lifecycle to graduation** in this work stream, with natural
   pause points at stage boundaries.
6. **Foundation rich-text carve is in scope as MAP candidates**:
   `@beep/lexical-schema` (modeling) + `@beep/editor` (ui-system); no driver
   package unless `@lexical/headless` engine-wrapping appears later (then
   mirror `drivers/konva`). One canonical portable document AST (`@beep/md`);
   AI vocabulary and Lexical state convert via codecs; run a lossiness check
   (Lexical format bitmask / alignment / indent) before locking the profile.
   **Drift note:** the handoff's first bullet (move `@beep/md` →
   `packages/foundation/modeling/md`) was **already executed** in PR #240
   (merged 2026-06-11) — cite, don't redo.
7. **Session setup**: exploration work runs from the beep-effect root; the
   effect-lexical-chat proof repo (machine-local checkout) is read-only
   reference. Proof-repo conventions do not override beep's.
8. **Convergence target**: the goals packets implement the E2E chat in
   `apps/professional-desktop` (currently a minimal shell — no runtime
   `Layer.ts`, no sidecar).

## 2026-06-12 — editor kit: build custom, lobehub demoted to reference

**Question:** Adopt `@lobehub/editor` vs build a custom Lexical block kit as
`@beep/editor` on the existing `@beep/ui` substrate? *(manifest open
question 1)*

**Answer:** Build custom. `@lobehub/editor` becomes UX design reference only.

**Rationale:** The proof built a working chat editor on raw `lexical` +
`@lexical/react` with no gaps. External sweep (see RESEARCH.md) settled the
unknowns: lobe-editor is MIT and active, but requires `antd`/`@lobehub/ui`/
`motion` peers (collides with shadcn/Tailwind) and pins **Lexical 0.42 with a
core patch** while `@beep/ui` ships 0.45. Adopting would also hand the node
vocabulary to lobehub's kernel instead of `@beep/lexical-schema`.

## 2026-06-12 — chat binding: turn kernel first, ACP deferred

**Question:** Does the chat surface bind first to ACP agent sessions, the
fixture-agent SDK loop, or both? *(manifest open question 3)*

**Answer:** The runtime's own turn-generation kernel first (agents slice):
ported Anthropic streaming kernel for real turns, deterministic fixture agent
behind the same interface for tests. ACP session binding is a named deferred
follow-on packet in MAP.md.

**Rationale:** Governance (`GetContextPacket`, `ProposeCandidateOutputSet`),
UsageRecord capture, and candidate writes all flow through the internal SDK
path; the proof's block-stream kernel is runtime-owned turn generation. ACP
sessions are a structurally different binding (external agent lifecycle, no
block-stream contract) and deserve their own packet once Thread/Turn
persistence exists.

## 2026-06-12 — Anthropic access: thin `drivers/anthropic`

**Question:** Thin `drivers/anthropic` for family symmetry, or direct
`@effect/ai-anthropic` in the agents-slice server?

**Answer:** Thin `@beep/anthropic` driver.

**Rationale:** `03-driver-boundaries.md` assigns technical knobs (retry
policy, timeouts, connection config) to driver `.config.ts`. The proof
produced exactly such repo-owned technical logic: ExecutionPlan
*acquisition-only* retries gated on `AiError.isRetryable`, and the
model-catalog ceiling pin (beta.79 SSE decode rejects newer model ids).
Family symmetry with `openai-compat`/`venice-ai`/`xai`; no slice imports a
provider library directly today.

## 2026-06-12 — PGlite confirmed (closes handoff decision 3)

**Question:** Confirm lean PGlite against sidecar-Postgres and SQLite?

**Answer:** Confirmed. PGlite via `pglite-socket` in the Tauri sidecar.

**Rationale:** `@electric-sql/pglite` 0.5.1 + `pglite-socket` 0.2.1 are
already in the root catalog. Preserves `EntityTable.pgTableFrom` + BaseEntity
+ `packages/_internal/db-admin` migration doctrine while staying local-first.
SQLite would require a net-new EntityTable SQLite projection; sidecar
Postgres breaks zero-install local-first. **Carried rabbit hole:** PGlite is
single-connection with a narrower extension surface — an early packet task
must smoke-prove `db-admin` migrations against PGlite.

## 2026-06-12 — Turn persists as aggregate + typed items

**Question:** How does `Turn` map to the proof's block-stream contract?

**Answer:** Turn is the aggregate (one exchange unit within a thread branch)
holding ordered tagged-union items: `Message | ToolCall | ToolResult |
ArtifactRef | Activity`. The proof's `AssistantBlock` stream is ephemeral
wire format during generation; completed blocks persist as the assistant
Message's content in the md-aligned AST. Branching = parent-turn lineage.

**Rationale:** Matches `data-model-shared-core.md` ("a turn may include:
messages, tool calls, tool results, generated artifacts, activities") while
keeping `ThreadTimeline` what the spec says it is — a rebuildable projection.
The proof's soft-truncate becomes the degenerate single-branch case.

## 2026-06-12 — UsageRecord captured at turn finalization (in scope)

**Question:** Is UsageRecord capture in scope for v1, and via what mechanism?

**Answer:** In scope. The turn kernel returns usage metadata (provider,
model, tokens, latency) with the completed turn; the persisting flow appends
an **epistemic-slice** `UsageRecord` linked through the turn's Activity.
OTLP metrics stay observability-only. Cost from a static price table in
driver config, marked approximate.

**Rationale:** The SPEC slice table puts usage records in `epistemic`;
telemetry is not a system of record. The proof's OTLP metrics prove the
numbers are available at stream completion. This is a real cross-slice
coordination point (workspace + epistemic) to model per doctrine 10.

## 2026-06-12 — governance: thread content exempt, proposal blocks gate

**Question:** Does assistant chat output enter as candidate state per runtime
governance, or is thread content exempt conversational record?

**Answer:** Thread content is exempt — turns persist as authoritative
conversational record at finalization. Candidate governance engages for
proposal-carrying blocks (claim/task/draft/artifact), which route through
`ProposeCandidateOutputSet` into candidate state + ApprovalGate with the
thread turn as provenance anchor.

**Rationale:** The candidate-write flow enumerates proposals ("a claim, task,
artifact, comment, or draft"); Thread is specified as a *durable* sequence of
turns with no candidate stage; Evidence may point to a thread turn — which
only works if turns are durable record. This is the command-surface framing
doing real work: schema-parsed blocks distinguish talk from proposed writes.

## 2026-06-12 — v1 block types: md-core + artifact-ref

**Question:** Which block types are v1? *(manifest open question 2)*

**Answer:** Persisted blocks: paragraph, heading, code, list, quote
(+ inline marks), and `artifact-ref`. Composer affordances (not persisted
blocks): mention, slash-command. Deferred: attachment, table, and proposal
blocks (claim/task/draft) — proposal blocks are the named first follow-on,
as the command-surface payoff.

**Rationale:** The md-core five are proof-proven E2E (streaming + render)
and survive the `@beep/md` lossiness check cleanly. Slash commands execute
rather than persist as document AST. `artifact-ref` is the one net-new
semantic block the command surface needs to point at runtime artifacts.
