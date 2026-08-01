# Desktop Chat Surface Spec

## Objective

The control plane's command surface is live in `apps/professional-desktop`:
a user starts a thread, sends rich-block messages, watches a streamed
assistant turn render block-by-block, edits a message (creating a branch
rendered Claude-style with a version selector), cancels in-flight turns, and
every turn persists locally in PGlite with a `UsageRecord` appended at
finalization. The agents-slice turn kernel serves both the Anthropic
streaming implementation and the deterministic fixture agent behind one
interface.

Depends on: `goals/rich-text-foundation` and `goals/workspace-thread-domain`
(both must close first).

Provenance: graduated from `explorations/agent-chat-interface` (back-links:
[`BRIEF.md`](../../explorations/agent-chat-interface/BRIEF.md),
[`DECISIONS.md`](../../explorations/agent-chat-interface/DECISIONS.md),
[`MAP.md`](../../explorations/agent-chat-interface/MAP.md)). Proof-repo
reference (read-only): `/home/elpresidank/YeeBois/projects/effect-lexical-chat/`
(same effect catalog `4.0.0-beta.79`).

## Non-Goals

- No ACP session binding (named follow-on: `acp-chat-binding`).
- No proposal blocks (claim/task/draft) — first follow-on; the governance
  hook is decided (thread content exempt; proposal blocks gate) but not
  built here.
- No attachment/table block types; no PDF export (md/XML export via existing
  `@beep/schema` codecs only).
- No collaboration; no multi-user presence.
- No general serialization-profile system — XML-for-Claude export only as
  the existing codecs allow.
- No branch-tree UI (LibreChat-style trees confuse users): version selector
  on edited messages, single-branch degenerate view first.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards (`standards/ARCHITECTURE.md`;
   `standards/architecture/{01,05,06,08,09,12}-*.md`).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `apps/professional-desktop` — sidecar lifecycle (`src-tauri`), app-local
  runtime `src/runtime/Layer.ts`, chat UI, build scripts.
- `packages/agents/*` (renamed slice) — turn-generation kernel in `server`,
  rpc declarations in `use-cases` `.rpc.ts`, atoms in `client` `.atoms.ts`.
- `packages/workspace/*` — thread/turn repositories + ThreadTimeline
  projection wiring as the slice's server surface requires.

## Constraints

- **Turn kernel port** (proof `server/AssistantTurn.ts`): native structured
  outputs reject the block-union schema ("compiled grammar is too large") —
  use the forced-tool pattern (non-strict tool `respond`, forced
  `tool_choice`, `disable_parallel_tool_use`); extract blocks from
  `input_json_delta` via `scanChunk` (port its property tests,
  proof `test/scanChunk.test.ts`); decode per block via
  `AnthropicStructuredOutput.toCodecAnthropic` (`effect/unstable/ai`).
- Streaming deltas are ephemeral wire format; only completed blocks persist
  as Message content (md-aligned AST). Cancel-in-flight via fiber
  interruption must leave no partial assistant row (proof-proven; rpc stream
  interruption propagates server-side).
- **Atom patterns** (proof `src/atoms.ts`): `Atom.family` per-thread queries
  with reactivity keys, `Reactivity.mutation`, `Atom.kvs` composer drafts.
  Hard lesson to honor: `Atom.Interrupt` disposes the node's Lifetime before
  the fiber unwinds — interrupt cleanup writes via `AtomRegistry`, never
  `ctx.set` in `Effect.onInterrupt`.
- **Sidecar** (proof `scripts/build-sidecar.ts`, `src-tauri/src/lib.rs`):
  bun-compiled `externalBin`, spawn/kill lifecycle, DB path → app data dir,
  secrets via env-or-`op read`. PGlite runs in the sidecar via
  `pglite-socket`.
- Live Layer composition is app-local
  (`apps/professional-desktop/src/runtime/Layer.ts`) — not in `use-cases`;
  no God Layers; drivers never product-aware.
- Observability per `12-observability.md`: rpc envelope carries trace
  context so webview + sidecar spans join one trace; `Metric.timer`
  perceived-latency + decode-failure counters; UsageRecord append at turn
  finalization is the system of record, OTLP is not.
- Public action errors / server-only port errors / driver errors / protocol
  failures die at their boundaries per `09-errors-across-boundaries.md`.

## Acceptance Criteria

- [x] E2E on a dev machine: create thread → send rich-block message →
      streamed assistant turn renders block-by-block → edit creates a branch
      with version-selector UX → cancel-in-flight leaves no partial row →
      relaunch app, thread history intact (PGlite).
      *(2026-07-31: one recorded full-UI pass against the live Anthropic
      kernel — real input, CAPTURE-GREEN, vision-judged — landed in
      `history/e2e-2026-07-31/`. The loop also surfaced and fixed the
      unreachable version-selector affordance.)*
- [x] Fixture agent runs behind the same kernel interface and powers the
      app-level contract tests (no real-LLM dependency in CI).
- [ ] `UsageRecord` rows appear at turn finalization with provider, model,
      tokens, latency, approximate cost, Activity link.
      *(2026-07-31 audit: only row-at-finalization persistence shipped —
      `ChatOrchestrator` appends `fixtureUsageRecord` on every path,
      including live Anthropic, with null tokens/latency/cost and a
      synthesized Activity id. Provider usage metadata capture remains open;
      see the Exception Ledger.)*
- [x] ThreadTimeline (single-branch degenerate view) renders history +
      tool-call placeholders + cost rollup.
- [x] Webview and sidecar spans join into one trace; perceived-latency and
      decode-failure metrics emit.
- [x] Repo quality gates pass; no unrelated refactors or formatting churn.
      *(Waiver on record: PR #243 was admin-merged during a GitHub outage
      with the hosted `Check` and `Lint Policy` lanes still red (infra
      artifacts — see README/Exception Ledger). Both lanes have since proven
      green against `main` content repeatedly, e.g. the 2026-07-31 PR #524
      run at `main` parity.)*

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/desktop-chat-surface/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/desktop-chat-surface/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/desktop-chat-surface` | Passes |
| Quality gates | `bun run beep yeet verify` | Green |
| Contract tests | fixture-agent app-level harness run | Green |
| E2E proof | screen recording or stepwise evidence in `history/` | All steps pass |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec (real-LLM runs need an Anthropic key —
  fixture agent covers CI).
- The same blocker repeats after reasonable investigation.
- Either dependency packet (`rich-text-foundation`,
  `workspace-thread-domain`) is not closed.

## Decision Log

Inherited from `explorations/agent-chat-interface/DECISIONS.md` (2026-06-12):
turn-kernel-first binding (ACP deferred); thread branching with
version-selector UX; UsageRecord at finalization; thread content exempt from
candidate gating; v1 block scope; convergence target professional-desktop.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Full dev-machine UI E2E evidenced piecewise only | E2E acceptance criterion | packet owner | Browser E2E + rpc-client finalize proof + contract tests cover the flow's pieces; no single recorded full-UI pass (edit-as-branch, version selector, UI cancel in one run) exists | Satisfied 2026-07-31 — recorded full-UI pass (browser-qa-loop, live Anthropic kernel) landed in `history/e2e-2026-07-31/`; row retained as the waiver record |
| UsageRecord provider fields unpopulated | UsageRecord acceptance criterion | packet owner | `fixtureUsageRecord` (null tokens/latency/cost, synthesized Activity id) is appended on every path including live Anthropic; kernel carries no provider usage metadata | Kernel surfaces provider usage metadata and the orchestrator appends real token/latency/cost + Activity link |
| PR #243 admin-merged with two hosted lanes red | Quality-gates acceptance criterion | packet owner | GitHub outage at merge time; `Check` passed locally identically to CI, `Lint Policy` hit the outage timeout (recorded in README) | Satisfied in substance — both lanes green on subsequent `main`-parity runs (e.g. PR #524, 2026-07-31); row retained as the waiver record |
