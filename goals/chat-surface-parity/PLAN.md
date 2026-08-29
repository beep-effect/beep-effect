# Chat Surface Parity Plan

## Status

Status: `complete` — all phases shipped and merged to `main` via PR #248
(2026-06-15). This status line lagged the closeout; reconciled 2026-07-31
(the real-Anthropic E2E was re-run green that day — see
`history/2026-07-31-real-anthropic-e2e-revalidation.md`).

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Re-validate the parity audit against current `main` + the POC (it may have drifted); confirm file paths/API surfaces; settle the two P0 gates (repair call-shape, title path). | Audit confirmed; both P0 gates decided; drift recorded in `history/`. |
| P1 Observability & UX gaps | complete | Land the low-risk dropped affordances (DevTools, RegistryProvider, toasts, turn metrics, title derivation, Grafana dashboard). Title derivation excepted (P0 gate 2). | Acceptance criteria for the obs/UX bucket met; gates green. |
| P2 Block repair loop | complete | Repair invalid streamed blocks (Haiku) across driver→server→handler instead of dropping them. | Repair contract test + driver test green; repair metric/span emit. |
| P3 Rich blocks | complete | Add mermaid (reuse `Pre`), table, and youtube blocks end-to-end (schema→lift→validate→render). | New nodes round-trip; render in streaming + viewer; no other-consumer regression. |
| P4 Verify & close | complete | Full verification (real CI lanes + real-LLM E2E), changesets, regenerated artifacts, reflection. | `yeet verify` green before PR; closeout reflection exists. |

## P0 — Research carry-over / re-validation

Input = the parity audit (`research/2026-06-15-poc-parity-audit.md`). Re-validate
the POC vs current `main` (both may have drifted) and confirm paths before
editing. **Two gates to settle here:**

1. **Repair call shape** — does `@effect/ai-anthropic` `beta.83` decode tool_use
   on the non-streaming `generateText` path, or does it still map
   `caller → toolId: undefined` and fail the response Part schema (POC
   `server/BlockRepair.ts:98-103`)? If it fails, the repair call uses the POC's
   `streamText`-consume-whole pattern. Decide before P2.
2. **Title-derivation path** — title derivation (P1.5) collides with the required
   `Thread.title` (`S.NonEmptyString`, no store mutation, sidebar hardcodes
   `"New thread"`). Pick the path before P1: a new `ThreadStore.setTitleIfEmpty`
   mutation (+ repo + RPC + atom) is lower-risk than a nullable-title schema
   migration (stop-listed).

## P1 — Observability, devtooling & UX gaps (low-risk; title derivation excepted — see P0 gate 2)

1. **Sidecar Effect DevTools** — `apps/professional-desktop/src/runtime/Observability.ts`:
   add a `DEVTOOLS`-gated layer composing `@beep/observability/server`
   `layerFilteredDevTools({ url, shouldPublish })`; `Layer.mergeAll` it with the
   existing OTLP layer. Compose the existing capability — do NOT hand-roll
   `effect/unstable/devtools` `DevTools.layer()` in the app.
2. **App `RegistryProvider`** — new app-local atom provider mirroring
   `apps/oip-web/src/runtime/OipAtomProvider.tsx` (RegistryProvider +
   `useAtomMount` of the browser runtime); wrap the root in
   `apps/professional-desktop/src/main.tsx` (currently only `AppThemeProvider`).
3. **Error toasts** — surface `runTurnAtom` failures via the existing
   `@beep/ui` sonner. Layering: `@beep/agents-client` must NOT import `@beep/ui`.
   Expose the turn error as observable atom state (read the `runTurnAtom`
   `AsyncResult` failure, or add a dedicated error atom) and fire the toast from
   the app/UI layer; mount `<Toaster/>` in the app shell.
4. **Turn-lifecycle metrics** — in `apps/professional-desktop/src/chat/ChatOrchestrator.ts`
   `streamAndPersist`: `agents_chat_turns_total`, `agents_chat_turn_failures_total`,
   `agents_chat_turn_duration` (histogram), `agents_chat_blocks_streamed_total`.
   No partial-persist metric (N/A by the locked no-partial-row contract).
5. **Title derivation** — derive a thread title from the first user message via
   the existing `ChatOrchestrator.ts` `documentToPlainText` (first line, ~64
   chars), set-if-empty. **Not zero-foundation (see P0 gate 2):** `Thread.title`
   is a required `S.NonEmptyString`, `ThreadStore` has no title mutation, and the
   sidebar passes a hardcoded `"New thread"`. Implement via the P0-chosen path —
   a new `ThreadStore.setTitleIfEmpty` mutation + repo impls + `ChatRpcs` method
   + atom is the lower-risk option (avoids the stop-listed schema migration).
6. **Grafana chat dashboard** — `docker/grafana/chat-dashboard.json` +
   provisioning (turns, perceived latency, blocks, errors), mirroring the POC.

## P2 — Block validation + repair loop (driver → server → handler)

- **Driver** — `packages/drivers/anthropic/src/Anthropic.repair.ts`:
  `repairInvalidBlock(slice, { model })`, Haiku via
  `AnthropicLanguageModelOptions.make({ model: "claude-haiku-4-5" })`, own
  2-attempt `ExecutionPlan`. Driver-internal `RepairError` in `Anthropic.errors.ts`.
  **Call shape per P0 gate 1:** prefer one-shot `LanguageModel.generateText()`,
  but if `beta.83` still fails tool_use decode on the non-streaming path (POC
  `BlockRepair.ts:98-103`), use `streamText` and consume the whole response.
- **Port error** — `BlockRepairFailed` in
  `packages/agents/use-cases/src/processes/AssistantTurn/AssistantTurn.repair-errors.ts`,
  exported from the `/server` subpath only. **Prerequisite:** `@beep/agents-use-cases`
  has no `/server` subpath yet (exports: `.`, `/public`, `/proof`, `/test`) —
  scaffold `src/server.ts` + the `package.json` export + tsconfig path first (copy
  `architecture-lab/use-cases` or `workspace/use-cases`). `TurnGenerationError`
  currently sits on `/public`; leave it unless it must become server-only.
- **Server adapter** — `packages/agents/server/src/AssistantTurn/BlockRepair.ts`:
  `attemptBlockRepair(indexed)` = validate → on-fail call driver repair →
  re-validate → emit repaired / drop+log; translate `RepairError` →
  `BlockRepairFailed`; metric `agents_assistant_turn_blocks_repaired_total{outcome}`;
  span `agents.assistant_turn.block_repair`. Port the POC `IssueReport` to build
  the repair prompt context. Today invalid blocks are dropped in
  `AnthropicTurnKernel.routeBlock` — repair slots between validation and drop.
  **Repair contract (one rule):** a block still invalid after the attempts is
  **dropped + logged** (repair is otherwise infallible, as in the POC); only a
  failed repair *call* becomes `RepairError` → `BlockRepairFailed`. The turn fails
  (handler → `ChatActionError`) only on a failed repair call, never because one
  block was unrepairable.
- **Handler** — attach the repair tail in `ChatOrchestrator.streamAndPersist`;
  translate `BlockRepairFailed` → `ChatActionError` at the boundary.
- The repair codec must decode the FULL `AssistantBlock` union (including the
  P3 rich blocks once they exist).

## P3 — Rich blocks (foundation-touching)

- **P3a Mermaid (low)** — represent as `Pre[language="mermaid"]` (LOCKED); prompt
  the model to emit a `code` block with `language="mermaid"` (no mermaid tag
  exists). The source validator and `CheckedMermaidBlock` filter are
  **re-authored** against `CodeBlock` (key on `language==="mermaid"`, read
  `block.code`) — they do NOT port from the POC's dedicated `MermaidBlock.source`;
  the happy-dom parse logic itself (`MermaidValidator`) is reusable, only its
  dispatch changes. Render via an `@beep/editor` language-aware decorator
  (`mermaid` dep; `ArtifactRefNode` is the `DecoratorNode` template) for the viewer
  AND a streaming-view branch in `chat/ui/StreamingBlocks.tsx` (see two-render note).
- **P3b Table (high)** — new `Table`/`TableRow`/`TableCell` schema classes in
  `packages/foundation/modeling/md/src/Md.model.ts` (+ the `Block` union); lexical
  `TableNode` in `packages/foundation/modeling/lexical/src/Lexical.model.ts` +
  bidirectional codec in `Lexical.codec.ts` (evaluate `@lexical/table`); register
  in `@beep/editor` `nodes.ts`. `TableBlock` in `AssistantContent` + `BlockToMd`
  lift; server arity validator; render in streaming + viewer.
- **P3c YouTube (medium)** — dedicated embed node: `@beep/md` node, lexical
  `YoutubeNode` (DecoratorNode), `@beep/editor` iframe decorator; `YouTubeBlock`
  + lift + 11-char video-id validator; render in streaming + viewer.
- **System prompt** — re-add mermaid/table/youtube authoring guidance in the
  kernel system prompt.
- **Codec checks** — re-add the `Checked*Block` sync filters at the
  structured-output codec so the provider rejects malformed turns mid-stream.
  `CheckedTableBlock` (arity) and `CheckedYouTubeBlock` (11-char id) port
  faithfully (dedicated blocks); the mermaid header check is **re-authored** onto
  `CodeBlock[language="mermaid"]` (no dedicated mermaid block).
- **Two render paths (all three blocks)** — `StreamingBlocks.tsx` renders raw
  `Turn.AssistantBlock` with no Lexical/editor decode, so the `@beep/editor`
  decorators cover only the read-only `EditorViewer`; each rich block also needs a
  streaming-view render branch. Budget the `mermaid` dep landing in both the
  streaming renderer and `@beep/editor`.

## P4 — Verify & close

- Property/round-trip tests for each new md/lexical node (Md→Lexical→Md +
  JSON-boundary, mirroring the `desktop-chat-surface` finalize-bug regression).
- Repair: fixture contract test (invalid → repaired) + a driver test.
- Update fixture-agent contract tests for the new block types; real-LLM E2E over
  the wire (render + persist mermaid/table/youtube), recorded in `history/`.
- **Quality gates**: run the REAL CI lanes + `bun run beep yeet verify` BEFORE
  the PR (prior-packet lesson — per-package green ≠ aggregate CI green). Add
  changesets for every touched lib. Regenerate generated artifacts (fallow
  boundaries, repo-exports catalog, docgen) since new packages/deps land.
- Reflection (P4 closeout).

## P4 Closeout Checklist

Before marking the packet closed (`status` → `completed-retained` / `complete`):

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique tooling,
   implementation, and the goal/prompt. Its YAML frontmatter must validate
   against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes; keep `SPEC.md` normative.
- Foundation work (md/lexical-schema/editor) is shared — `@beep/md` is broadly
  consumed (agents-*, workspace-*, `@beep/repo-cli`, lexical-schema); `@beep/editor`
  today only by this app. Verify those `@beep/md`/`@beep/lexical-schema` consumers
  still pass (NOT `apps/oip-web`, which uses none of md/lexical/editor).
- Real-LLM verification needs an Anthropic key (env-or-`op read`); CI relies on
  the fixture agent only.
- Phases are independently shippable; P1 can land as its own PR before P2/P3.

## Verification Commands

```sh
test "$(wc -m < goals/chat-surface-parity/GOAL.md)" -le 4000
jq . goals/chat-surface-parity/ops/manifest.json
rg -n "chat-surface-parity|GOAL.md|agentLaunchers|packetAnchorDocument" goals/chat-surface-parity
git diff --check -- goals/chat-surface-parity
```
