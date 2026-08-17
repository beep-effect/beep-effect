# GOAL: ship the E2E desktop chat surface

Repo: `beep-effect` (this checkout).

Outcome: `apps/professional-desktop` runs the chat command surface E2E —
rich-block composer, streamed block-by-block assistant turns, edit-as-branch,
cancel-in-flight, PGlite persistence across relaunch, UsageRecord at turn
finalization — with the fixture agent powering CI contract tests.

Prerequisites: `goals/rich-text-foundation` and
`goals/workspace-thread-domain` are closed. Stop if not.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/desktop-chat-surface/README.md`
- `goals/desktop-chat-surface/SPEC.md`
- `goals/desktop-chat-surface/PLAN.md`
- `goals/desktop-chat-surface/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and standards named by
`SPEC.md`. Proof-repo reference (read-only, same effect catalog):
the machine-local `effect-lexical-chat` checkout — esp.
`server/AssistantTurn.ts` (kernel), `src/atoms.ts` (Atom patterns),
`scripts/build-sidecar.ts` + `src-tauri/src/lib.rs` (packaging).

Scope:

- In: `apps/professional-desktop` (sidecar, `src/runtime/Layer.ts`, chat UI),
  `packages/agents/*` (kernel in server, `.rpc.ts` in use-cases, `.atoms.ts`
  in client), `packages/workspace/*` (repositories, ThreadTimeline wiring).
- Out: ACP binding; proposal blocks; attachment/table blocks; PDF export;
  collaboration; branch-tree UI (version selector only).

Key constraints (SPEC.md is normative):

- Kernel port: forced-tool structured output (non-strict `respond`, forced
  tool_choice, no parallel tool use), `scanChunk` block extraction with its
  property tests, per-block decode via
  `AnthropicStructuredOutput.toCodecAnthropic`.
- Deltas are ephemeral; only completed blocks persist (md-aligned AST).
  Cancel must leave no partial assistant row.
- Atom lesson: interrupt cleanup writes via `AtomRegistry` — `ctx.set` in
  `Effect.onInterrupt` is silently dropped.
- Layer composition is app-local; rpc envelope carries trace context;
  UsageRecord is the system of record, OTLP is not.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command
   output.
5. Update packet evidence/status if the implementation changes readiness.
6. At P3 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied (E2E flow, fixture-agent
      CI, UsageRecord, ThreadTimeline, joined traces).
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/desktop-chat-surface/GOAL.md)" -le 4000
jq . goals/desktop-chat-surface/ops/manifest.json
git diff --check -- goals/desktop-chat-surface
bun run beep yeet verify
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it. Real-LLM runs
need an Anthropic key — the fixture agent covers CI.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
