# Research

## External Landscape

Recorded 2026-06-12 (web sweep; every claim cited).

### `@lobehub/editor` ([lobehub/lobe-editor](https://github.com/lobehub/lobe-editor))

- **MIT** licensed; dual-layer architecture — framework-agnostic kernel
  (plugin base classes, DI service container) + React integration layer, on
  Meta's Lexical ([repo README](https://github.com/lobehub/lobe-editor)).
- Latest **4.17.1** (~2026-06-09); very active (189 releases, ~595 commits)
  ([npm](https://registry.npmjs.org/@lobehub/editor/latest),
  [releases](https://github.com/lobehub/lobe-editor)).
- **Adoption blockers**: peer deps require `antd ^6.1.1`, `@lobehub/ui ^5.0.0`,
  `motion ^12.0.0` (collides with this repo's shadcn/Tailwind substrate), and
  it pins **Lexical 0.42.0 with a pnpm patch to core lexical** — lagging the
  0.45 line `@beep/ui` already ships
  ([npm manifest](https://registry.npmjs.org/@lobehub/editor/latest)).
- Chat-input composition worth borrowing as *design reference*: `ChatInput`
  component, `/` and `@` command menus with async search, `ReactFilePlugin`
  attachments, 10+ composable plugins
  ([README](https://github.com/lobehub/lobe-editor)).

### Lexical ecosystem

- Current stable **v0.45.0** (2026-05-28); roughly monthly cadence with
  routine minor-breaking changes (v0.45 changed selection/reconcile
  semantics) ([releases](https://github.com/facebook/lexical/releases)).
  `@beep/ui`'s 0.45 is current.
- Custom nodes implement static `getType()`/`clone()`/`importJSON()`;
  recommended pattern routes through `updateFromJSON` so subclasses inherit
  ([Nodes doc](https://lexical.dev/docs/concepts/nodes)).
- **Serialized-state durability is app-managed**: per-node `version` field +
  explicit old-schema handling in `importJSON`; no hard upstream guarantee
  ([Nodes doc](https://lexical.dev/docs/concepts/nodes)). This is direct
  support for owning the persisted AST in a schema-first package and treating
  Lexical state as derived.
- Collaboration prior art: official `@lexical/yjs` + `LexicalCollaborationPlugin`
  ([docs](https://lexical.dev/docs/packages/lexical-yjs)); EditorState is
  immutable/"time-travel ready", but **no first-party branching/fork API**
  ([facebook/lexical](https://github.com/facebook/lexical)).

### Chat-input / thread UX prior art

- **Notion**: `/` block menu anywhere; `@page`/`@person` mentions as
  auto-updating inline references
  ([Notion help](https://www.notion.com/help/writing-and-editing-basics)).
- **Claude.ai**: artifacts in a side pane; **editing a message creates a
  branched conversation version** with a version selector
  ([Claude Help Center](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them)).
- **ChatGPT Canvas**: separate editor pane beside chat with inline AI edits
  ([OpenAI Help](https://help.openai.com/en/articles/9930697-what-is-the-canvas-feature-in-chatgpt-and-how-do-i-use-it)).
- **LibreChat**: explicit message tree — each regeneration is a branch; 3
  fork scopes; users report the tree model is hard to grok
  ([fork docs](https://www.librechat.ai/docs/features/fork),
  [discussion #2908](https://github.com/danny-avila/LibreChat/discussions/2908)).
  UX lesson: render branching like Claude (version selector), not like a
  raw tree.
- **Open WebUI**: TipTap/ProseMirror rich input, saved prompts as slash
  commands ([prompts docs](https://docs.openwebui.com/features/workspace/prompts/)).

### Thread export / PDF

- `@react-pdf/renderer`: JSX → real PDFs client-side, but its own layout
  system (no HTML/CSS reuse)
  ([roundup](https://www.react-pdf-kit.dev/blog/6-open-source-pdf-generation-and-modification-libraries-every-react-dev-should-know-in-2025)).
- Browser/webview print-to-PDF: zero deps but output varies; Tauri's wry has
  a **long-open gap for cross-platform silent webview→PDF**
  ([wry #707](https://github.com/tauri-apps/wry/issues/707)).
- wkhtmltopdf archived (2023) — avoid
  ([DocRaptor](https://docraptor.com/wkhtmltopdf-alternatives)); headless
  Chrome is the successor but means shipping a browser.
- **Model-preferred serialization**: Anthropic's docs recommend XML-tag
  structuring (`<documents><document index="n">…`) because tags "help Claude
  parse complex prompts unambiguously"
  ([Anthropic docs](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/use-xml-tags)) —
  supports an XML-ish model-facing thread export via existing `@beep/schema`
  Xml codecs.

## Adjacent Proof: `effect-lexical-chat`

Recorded 2026-06-12. A standalone proof repo at
the machine-local `effect-lexical-chat` checkout built the full
chat stack E2E on the **same effect catalog `4.0.0-beta.79`** as this repo,
so findings transfer directly. Handoff:
`handoff-agent-chat-exploration.md` in that checkout.

- **Streaming structured-output kernel** (`server/AssistantTurn.ts`): native
  structured outputs (`output_config.format`) reject the block-union schema
  with "compiled grammar is too large" → forced-tool pattern (non-strict tool
  `respond`, `tool_choice` forced, `disable_parallel_tool_use`). Blocks are
  extracted from `input_json_delta` by `scanChunk`, an incremental,
  string-escape-aware JSON array-element scanner (property-tested in
  `test/scanChunk.test.ts`), and schema-decoded per block via
  `AnthropicStructuredOutput.toCodecAnthropic` (upstream in
  `effect/unstable/ai`). Retries: ExecutionPlan wraps *acquisition only*
  (`server/Anthropic.ts`), gated on `AiError.isRetryable`.
- **Pure Lexical schemas** (`shared/lexical-schema.ts`): serialized
  editor-state tagged unions import only `effect` — direct evidence a
  modeling package needs no runtime `lexical` dependency.
- **Portable block AST + lift** (`shared/assistant-schema.ts`): block/inline
  union ~isomorphic to `@beep/md`'s AST; `assistantContentToLexical` lifts it
  to editor state server-side as pure JSON construction (no headless engine).
- **Chat UX proven E2E**: multi-conversation sidebar (title derivation,
  activity ordering), edit-rewrites, cancel-in-flight via fiber interruption
  (rpc stream interruption propagates server-side; no partial assistant row),
  per-conversation composer drafts (`Atom.kvs` over localStorage).
- **AtomRpc client patterns** (`src/atoms.ts`): `Atom.family`
  per-conversation queries with reactivity keys, `Reactivity.mutation`,
  `useAtomMount` (an unobserved `runtime.fn` atom gets released and its fiber
  interrupted). Hard lesson: **`Atom.Interrupt` disposes the node's Lifetime
  before the fiber unwinds**, so `ctx.set` in `Effect.onInterrupt` is
  silently dropped — interrupt cleanup must write via `AtomRegistry`.
- **Observability topology**: client + server OTLP with zero OpenTelemetry
  SDK deps; rpc envelope carries trace context so web and sidecar spans join
  into one Tempo trace; `Metric.timer` perceived-latency + decode-failure
  counters; provisioned Grafana dashboard (`observability/grafana/`).
  Directly relevant to `UsageRecord`/`ThreadTimeline` read models.
- **Model-catalog ceiling**: `@effect/ai-anthropic`'s generated catalog at
  beta.79 validates `message.model` on the SSE response — newer ids fail
  decode; the proof pinned `claude-opus-4-6`. Upstream report:
  `effect-v4-anthropic-model-catalog-report.md` (proof repo root).
- **Tauri packaging**: `bun build --compile` sidecar as `externalBin`
  (`scripts/build-sidecar.ts`, `src-tauri/src/lib.rs` spawn/kill lifecycle,
  `CHAT_DB_PATH` → app data dir, secrets via env-or-`op read`); deb + rpm
  verified. Directly informs the professional-desktop sidecar TODO.

## In-Repo Capability Inventory

Recorded 2026-06-12 from a full stack exploration (agent sweeps + doc reads).

### Target surface

- `apps/professional-desktop` — Tauri 2 + React 19 + Vite shell ("Agentic
  Professional Runtime"). Health dashboard only; **no chat UI exists**. One
  Tauri command (`professional_desktop_health`). State pattern:
  `@effect/atom-react` `Atom.family` + tagged-union load state
  (`src/App.tsx`).
- The former professional runtime proof app has been removed; remaining runtime
  data-loop fixtures live under the goal packet until that design is retired or
  moved.

### Conversation data model

- Thread + Message/Turn are **specified but unimplemented**:
  `goals/agentic-professional-runtime/docs/data-model-shared-core.md` —
  "UI may say 'chat'; the model says `Thread` because branching, replay, and
  sub-agent lineage matter." Turn = messages, tool calls, tool results,
  artifacts, activities. `ThreadTimeline` read model specified (history +
  tool calls + activities + cost rollups).
- `packages/workspace/domain` implements only: Workspace, EmailArtifact,
  ContextPacket, Candidate{Project,Task,Draft}, ApprovalGate,
  ApprovalDecision, CandidateLifecycle. Thread/Turn: NOT FOUND (gap to fill
  at graduation time).

### Editor/UI substrate

- `@beep/ui` (`packages/foundation/ui-system/ui`) already depends on
  **Lexical 0.45** with a starter block:
  `src/components/blocks/editor-00/` (LexicalComposer + RichTextPlugin,
  Heading/Quote/Paragraph/Text nodes, OnChange -> `SerializedEditorState`
  JSON) plus `editor/themes/editor-theme.ts` and
  `editor/editor-ui/content-editable.tsx` — all exported.
- `src/components/conversation.tsx` — Conversation/Content/EmptyState/
  ScrollButton scaffold (use-stick-to-bottom) with Storybook stories.
- ~70 shadcn components, Tailwind v4, MUI, `AppThemeProvider`;
  `apps/storybook` (Storybook 10) for showcase.
- `@lobehub/*` deps: NOT FOUND anywhere in the repo.
- Repo law: generic UI substrate belongs in foundation ui-system;
  `@beep/shared-ui` is cross-slice product semantics only.

### Agent connectivity (what "send" means here)

- `@beep/acp` (`packages/drivers/acp`) — Effect-native Agent Client Protocol
  driver (generated wire schema, `AcpClient`/`AcpAgent`, typed protocol
  errors).
- `@beep/ai-provider-cli` — Claude/Codex CLI capability wrapper.
- Model drivers: `@beep/openai-compat` (chat completion + streaming schemas),
  `@beep/xai`, `@beep/venice-ai`; catalog: `@effect/ai-anthropic|openai|
  openrouter` 4.0.0-beta.79.
- SDK contracts: `GetContextPacket`, `ProposeCandidateOutputSet` in
  `@beep/agent-capability-use-cases/public`.

### Schema & export machinery

- `@beep/schema` (`packages/foundation/modeling/schema`): LiteralKit, tagged
  unions, DomainModel.make/Model.Class, EntityId/$I composers; codecs for
  **Markdown** (micromark + GFM), **Xml** (fast-xml-parser 5.8), Csv, Json,
  Html, Yaml. Thread-to-MD/XML export machinery largely exists.
- PDF export: NOT FOUND (new dependency required if kept in scope).

## Constraints Discovered

- Governance shapes the chat surface: agents read bounded context and propose
  **candidate** writes only; human approval promotes to truth
  (`goals/agentic-professional-runtime/README.md` locked decisions). A chat
  "send" is a governed runtime interaction, not a raw completion call.
- Effect/TypeScript SDK is canonical; MCP is an adapter over it.
- Message editing implies thread **branching** — already doctrine in the data
  model; the editor must not fight it.
- Desktop runtime = Tauri webview, React 19 via repo catalog.
