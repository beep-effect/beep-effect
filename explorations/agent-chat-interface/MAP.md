# Map

Candidate goal packets decomposed from [`BRIEF.md`](./BRIEF.md). Every major
component cites an existing repo capability
([`standards/repo-exports.catalog.md`](../../standards/repo-exports.catalog.md)
and local package/docs evidence) or is marked **NET-NEW**. Proof-repo ports cite
`/home/elpresidank/YeeBois/projects/effect-lexical-chat/` (read-only
reference; same effect catalog `4.0.0-beta.79`).

## Dependency graph

```txt
(a) rich-text-foundation ──→ (c) desktop-chat-surface
(b) workspace-thread-domain ─→ (c) desktop-chat-surface
        (a) and (b) are independent of each other
follow-ons (after c): acp-chat-binding, proposal-blocks, thread-pdf-export
```

## (a) `rich-text-foundation` — schema-first Lexical modeling + editor kit

Mission: give the repo one canonical rich-text pipeline — md AST ↔ Lexical
state ↔ React editor — as foundation substrate.

| Component | Capability basis |
| --- | --- |
| `@beep/lexical-schema` (`packages/foundation/modeling/lexical`): Effect Schema models of `SerializedEditorState` + node tagged unions; zero runtime `lexical` imports, devDep for dtslint | **NET-NEW** package; pattern proven in proof `shared/lexical-schema.ts` (imports only `effect`); placement precedent `packages/foundation/modeling/{rdf,ontology}` |
| Md ↔ Lexical codecs (incl. lossiness check: format bitmask/alignment/indent) | `@beep/md` AST at `packages/foundation/modeling/md` (moved in PR #240); codec precedent `@beep/schema` Markdown/Xml codecs (`packages/foundation/modeling/schema`) |
| `@beep/editor` (`packages/foundation/ui-system/editor`): viewer, composer primitives, theme, node registration, md shortcuts | **NET-NEW** package; substrate exists — `@beep/ui` Lexical 0.45 `editor-00` block, `editor-theme.ts`, `content-editable.tsx`, `conversation.tsx` (all exported) |
| Block render of assistant content (server-side lift, no headless engine) | proof `shared/assistant-schema.ts` `assistantContentToLexical` (pure JSON construction) |

First vertical slice (of the whole map): a proof-fixture assistant turn
(md-core blocks) decoded through `@beep/lexical-schema` and rendered in the
`@beep/editor` read-only viewer in `apps/storybook` — proves schema + editor
before any persistence exists.

## (b) `workspace-thread-domain` — Thread/Turn/Message entities + tables

Mission: implement the runtime spine's conversation model as workspace-slice
domain + persistence, on local-first PGlite.

| Component | Capability basis |
| --- | --- |
| Thread / Turn / Message entities (Turn = aggregate + ordered typed items; branching = parent-turn lineage) | **NET-NEW** entities; spec `goals/agentic-professional-runtime/docs/data-model-shared-core.md`; mechanism `BaseEntity.Class` + persisted descriptors (`packages/shared/domain/src/entity/BaseEntity.ts`) |
| Tables + migrations | `EntityTable.pgTableFrom` (`packages/drivers/drizzle`); table helpers `packages/shared/tables/src/table/Table.ts`; migrations `packages/_internal/db-admin`; lands in existing `packages/workspace/{domain,tables}` |
| PGlite storage + early migration smoke task | `@electric-sql/pglite` 0.5.1 + `pglite-socket` 0.2.1 (root catalog); **NET-NEW** wiring |
| `drivers/anthropic` (`@beep/anthropic`): acquisition Layer, ExecutionPlan acquisition-only retry, model-catalog pin, technical `.config.ts` | **NET-NEW** package; family pattern `packages/drivers/{openai-compat,venice-ai,xai}`; logic port from proof `server/Anthropic.ts`; lib `@effect/ai-anthropic` 4.0.0-beta.79 (catalog) |
| `agent-capability` → `agents` slice rename (+ runtime SPEC.md slice-table amendment) | existing `packages/agent-capability/{domain,use-cases}`; cleanup-on-touch inside this packet |
| `UsageRecord` entity (epistemic slice) + turn-finalization append via Activity link | **NET-NEW** entity; spec `data-model-shared-core.md` (UsageRecord, Activity); cross-slice flow per `standards/architecture/10-cross-slice-coordination.md` |

## (c) `desktop-chat-surface` — E2E chat in professional-desktop

Mission: the control plane's command surface, live: streamed block turns,
branch-on-edit, local persistence, usage capture. Depends on (a) + (b).

| Component | Capability basis |
| --- | --- |
| Streaming turn kernel in agents-slice server (forced-tool structured output, `scanChunk` block extraction, per-block decode) | port of proof `server/AssistantTurn.ts` + `test/scanChunk.test.ts` (property tests); `AnthropicStructuredOutput.toCodecAnthropic` (`effect/unstable/ai`, catalog) |
| Fixture agent behind the same kernel interface | runtime data-loop fixtures retained in the goal packet; SDK contracts `GetContextPacket`/`ProposeCandidateOutputSet` (`@beep/agent-capability-use-cases/public`) |
| Sidecar lifecycle + app-local runtime `Layer.ts` in `apps/professional-desktop` | **NET-NEW** for this app; port of proof `scripts/build-sidecar.ts` + `src-tauri/src/lib.rs` (bun-compiled `externalBin`, spawn/kill, app-data DB path) |
| Chat UI: thread list, composer, streamed block rendering, edit-as-branch (version-selector UX), cancel-in-flight | `@beep/editor` from (a); AtomRpc patterns from proof `src/atoms.ts` (`Atom.family`, `Reactivity.mutation`, `Atom.kvs` drafts, AtomRegistry interrupt-cleanup lesson); existing `@effect/atom-react` usage in `apps/professional-desktop/src/App.tsx` |
| ThreadTimeline rendering (single-branch degenerate view first) | read-model spec `data-model-shared-core.md`; **NET-NEW** projection |
| Observability: trace-joined client/server spans, perceived-latency + decode-failure metrics | proof topology (OTLP, rpc trace envelope, `Metric.timer`); repo doctrine `standards/architecture/12-observability.md` |

## Deferred follow-ons (named, not scoped here)

- `acp-chat-binding` — drive external ACP agents from the same chat surface
  (`@beep/acp` driver exists, `packages/drivers/acp`).
- `proposal-blocks` — claim/task/draft blocks routing through
  `ProposeCandidateOutputSet` + ApprovalGate (the command-surface payoff).
- attachment/table block types.
- `thread-pdf-export` — PDF is net-new (no repo capability; see RESEARCH.md
  options); md/XML export ships in v1 via existing codecs.
