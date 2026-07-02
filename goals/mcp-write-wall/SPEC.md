# MCP Write Wall Spec

## Objective

Wire `@beep/mcp-kit`'s tier-gate dispatch wrapper (`TierGate`,
`dispatchWithTierGate`, `fromApprovedToolsPolicy`) into
`packages/drivers/nlp-mcp`'s `tools/call` dispatch path, proving the
fail-closed candidate→approved wall end-to-end against a real write-capable
host: `NlpToolkit`'s four stateful tools (`CreateCorpus`, `LearnCorpus`,
`DeleteCorpus`, `LearnCustomEntities`), each carrying an accurate,
judgment-based `Tool.Destructive`/read-only annotation, with fixture proof
tests for both the approved and refused dispatch paths and a log-only audit
trail for this proving slice.

Graduated 2026-07-02 from
[`explorations/mcp-auth-gated-registration`](../../explorations/mcp-auth-gated-registration/README.md)
(BRIEF + MAP + resolved DECISIONS are the design provenance; this SPEC is the
normative contract). Named as the `mcp-write-wall` follow-on candidate goal in
[`MAP.md`](../../explorations/mcp-auth-gated-registration/MAP.md) and Q7 of
[`DECISIONS.md`](../../explorations/mcp-auth-gated-registration/DECISIONS.md).

## Non-Goals

<!-- Seeded from MAP.md's mcp-write-wall row + DECISIONS Q7 + this goal's own P0-equivalent grounding pass. -->

- **No `UsageRecord.metadata` persistence wiring.** Q7's original design
  intent was "each gated call is audited into the existing
  `UsageRecord.metadata` jsonb column"
  (`packages/epistemic/domain/src/entities/UsageRecord/UsageRecord.model.ts:69,95-97`).
  This goal deviates for its proving slice: `packages/drivers/nlp-mcp` has
  zero dependency on `@beep/epistemic-domain` or `@beep/epistemic-use-cases`
  today (confirmed via `package.json` and a repo-wide grep), so wiring
  persistence here would add an unrelated dependency edge to a driver
  package that has none. This goal's audit output is a sanitized
  `TierGateAuditRecord` written to a log/span, not persisted. Recorded as a
  formal exception (see Exception Ledger) with a back-link to Q7 for a
  future goal with real epistemic-domain ties.
- No changes to `packages/drivers/uspto-mcp` or `packages/drivers/m365-mcp`
  — both are read-only hosts per their own SPECs; neither has a
  write/gateable tool to prove the wall against.
- No behavior changes to `NlpToolkit`'s tool logic itself (what
  `CreateCorpus`/`LearnCorpus`/`DeleteCorpus`/`LearnCustomEntities` actually
  do) — only annotation and dispatch-wrapping.
- No `@beep/mcp-kit` API changes beyond what composing `TierGate` at
  `nlp-mcp`'s real dispatch seam needs. Unlike the sibling goals (which were
  told not to grow the kit unilaterally), an additive kit export here — if
  needed to compose `TierGate` with the existing `sanitizedToolkit` span
  wrapper at the same per-tool dispatch seam — is in scope: this goal's
  entire point is proving the wall against a real host, so a real-consumer-
  driven addition is expected, not speculative (precedent:
  `mcp-host-retrofit` added `sanitizedToolkit` itself under the same
  reasoning). Do not reopen `TierGate`'s or `SanitizedSpan`'s existing
  exported contracts.
- Optional, not required: the kit-side "untrusted external context"
  description-suffix helper (`mike#7` nugget — prompt-injection hardening,
  explicitly not an annotation per
  `explorations/mcp-auth-gated-registration/research/tier-gating-and-tool-governance-ethical-wall.md`).
  Fold in if it falls out naturally from Deliverable #1's annotation pass;
  otherwise record as a named follow-up in the closeout reflection, not
  silently dropped.
- No MCP `2025-11-25` reliance (bundled `McpServer` speaks `2025-06-18`).
- No live network integration tests — fixture-based, real production Layers
  (`WinkNlpToolkitLive`), mirroring
  `packages/drivers/nlp-mcp/test/SanitizedSpan.test.ts`'s shape.

## Source Hierarchy

1. User objective: the graduated exploration's resolved decisions
   ([`DECISIONS.md`](../../explorations/mcp-auth-gated-registration/DECISIONS.md)
   Q7) and
   [`MAP.md`](../../explorations/mcp-auth-gated-registration/MAP.md)'s
   `mcp-write-wall` row.
2. `AGENTS.md`, `CLAUDE.md`, and required skills (`effect-first-development`,
   `schema-first-development`, `effect-services`).
3. Governing architecture standards: `standards/ARCHITECTURE.md`;
   `standards/architecture/{02-shared-kernel,03-driver-boundaries,07-non-slice-families,09-errors-across-boundaries,12-observability}.md`.
4. `goals/mcp-kit/SPEC.md` — the kit contract this goal consumes (do not
   reopen its existing exported contracts).
5. `goals/mcp-host-retrofit/PLAN.md`'s P0 finding — the prior grounding pass
   on `NlpToolkit`'s four stateful tools and `TierGate`'s fail-closed
   default; do not re-derive facts it already confirmed.
6. This `SPEC.md`.
7. `PLAN.md`.
8. `GOAL.md`.
9. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/drivers/nlp-mcp` (existing package) — `src/Server.ts` (the
  `tools/call` dispatch composition, currently
  `Layer.mergeAll(sanitizedToolkit(NlpToolkit)..., sanitizedToolkit(StreamingToolkit)...)`
  at `Server.ts:102-108`).
- `packages/foundation/capability/nlp-processing` (existing package) — the
  four stateful tool definition files
  (`src/Tools/{CreateCorpus,LearnCorpus,DeleteCorpus,LearnCustomEntities}.ts`)
  plus whichever remaining `NlpToolkit` tool files or `NlpToolkit.ts`
  assembly point (`src/NlpToolkit.ts:89-115`) is the right site for the
  mechanical non-destructive annotations required by Deliverable #1's second
  half (confirm the exact site at P0 — `mcp-host-retrofit` annotated
  `StreamingToolkit`'s tools per-tool at their definition files, not at
  toolkit assembly; mirror that unless P0 finds a reason not to).
- `packages/foundation/capability/mcp-kit` (existing package) — additive
  only, and only if composing `TierGate` with `sanitizedToolkit` at the
  per-tool dispatch seam (`SanitizedSpan.ts:206-223`'s
  `registerSanitizedToolkit` loop, wrapping `built.handle(...)`) requires a
  new exported combinator. Do not touch `TierGate.ts`'s or `SanitizedSpan.ts`'s
  existing exports.
- No changes to `packages/drivers/uspto-mcp`, `packages/drivers/m365-mcp`, or
  any non-tool surface of `@beep/nlp-processing`.

## Deliverables

1. **Accurate `Tool.Destructive`/read-only annotations across `NlpToolkit`'s
   full tool surface.**
   - **Judgment-graded (the four stateful tools, currently zero
     annotations):** `CreateCorpus` (`Tools/CreateCorpus.ts:75-81` — creates
     new session state, does not destroy existing data), `LearnCorpus`
     (`Tools/LearnCorpus.ts:81-87` — mutates an existing corpus session
     in-place), `DeleteCorpus` (`Tools/DeleteCorpus.ts:58-64` — irreversibly
     discards a corpus session's in-memory index), `LearnCustomEntities`
     (`Tools/LearnCustomEntities.ts:99-105` — mutates shared engine state by
     merging or replacing custom entity patterns). Judge each on its actual
     read/write/idempotent/open-world semantics per the MCP tool-annotation
     spec's definitions — do not blanket-copy one tool's hints onto another,
     and do not assume "stateful" implies "destructive" (MCP's
     `destructiveHint` concerns updates that may be destructive, which is a
     narrower claim than "this tool has side effects").
   - **Mechanical companion, required by `TierGate`'s own fail-closed
     default:** `TierGate.ts`'s `isDestructive` (`TierGate.ts:301-302`)
     resolves `Context.getOrElse(tool.annotations, AiTool.Destructive, () =>
     true)` — any tool with no `Tool.Destructive` annotation at all defaults
     to destructive. Wiring the gate against `NlpToolkit` without also
     annotating its other ~21 tools as non-destructive would fail-closed-
     refuse every read tool, not only the four write tools. Annotate the
     remainder with `annotateFourHints(..., readOnlyToolHints)`
     (`packages/foundation/capability/mcp-kit/src/ToolAnnotations.ts:76-84,102-107`),
     mirroring `StreamingToolkit`'s precedent from `mcp-host-retrofit`
     (mechanical — read/count/filter/load operations, no per-tool judgment
     needed).
2. **Wire `TierGate` into `nlp-mcp`'s dispatch.** The proven interception
   point is `built.handle(...)` inside `registerSanitizedToolkit`'s per-tool
   loop (`SanitizedSpan.ts:206-223`) — `mcp-host-retrofit` empirically
   confirmed wrapping only the outer `Layer.launch`/`callTool` call site does
   NOT suppress leaks reliably, because `registerToolkit`'s
   `Effect.provideContext(services)` does not carry forward a build-time
   override; the same reasoning applies to gating. Compose
   `dispatchWithTierGate` (`TierGate.ts:407-418`) at this seam — either by
   extending `sanitizedToolkit` or adding a sibling combinator in
   `@beep/mcp-kit` — so `nlp-mcp/src/Server.ts` mounts `NlpToolkit` (and, if
   warranted, `StreamingToolkit`) through the gate. Define a
   `TierGatePolicy` (`TierGate.ts:284-293`) for `nlp-mcp` naming which of the
   four stateful tools are pre-approved to dispatch despite being
   destructive vs which are refused by default — a judgment call, not a
   blanket allow or deny (e.g., incremental-learning operations may be
   approved while the one irreversible action is refused by default; decide
   and document the actual reasoning per tool at P0/P1).
3. **Fixture proof tests for both the approved and refused paths (no live
   network).** Follow `packages/drivers/nlp-mcp/test/SanitizedSpan.test.ts`'s
   shape: mount the tier-gated toolkit over `McpServer.McpServer.layer` with
   real `NlpToolkit`/`WinkNlpToolkitLive` production layers (this precedent
   already proves real-layer fixture dispatch works here — no toolkit
   mocking needed), provide a `TierGate` layer via
   `TierGate.of(fromApprovedToolsPolicy(...))`, and call `server.callTool(...)`
   for at least one approved tool and one refused tool, asserting on the
   dispatch outcome and the produced `TierGateAuditRecord`.
4. **Audit sink: log-only for this proving slice.** Every gated dispatch
   (approved or refused) produces a `TierGateAuditRecord` (already shaped
   for the `UsageRecord.metadata` jsonb sink per the kit's existing design,
   `TierGate.ts:12-15`) and this goal logs it (e.g. `Effect.log` or a
   structured console/span record) rather than persisting it. See Non-Goals
   and the Exception Ledger for the deviation from Q7's original persisted-
   audit intent.
5. **Optional:** the kit-side "untrusted external context" description-
   suffix helper (`mike#7` nugget). Fold in if it falls out naturally from
   Deliverable #1's annotation pass; else record as a named follow-up.

## Constraints

- **Effect pin:** `effect@4.0.0-beta.92`; re-verify at P0 that
  `@beep/mcp-kit`'s exported `TierGate`/`SanitizedSpan`/`ToolAnnotations`
  surfaces still match this goal's expected call shape.
- **Schema-first, effect-first:** namespace-first helper imports; repo
  lint/docgen gates pass; no new `unknown` in error channels introduced by
  this goal.
- **Test shape:** fixture-based, real production Layers, no live network —
  mirrors `packages/drivers/nlp-mcp/test/SanitizedSpan.test.ts`.
- **Judgment discipline:** Deliverable #1's four-tool annotation and
  Deliverable #2's approval policy both require per-tool reasoning, not a
  blanket copy or a blanket allow/deny — document the reasoning for each of
  the four stateful tools' destructive hint and approval status.
- **Mechanical annotation of the remaining ~21 `NlpToolkit` tools must not
  change their observable behavior** — hint-only, same discipline as
  `mcp-host-retrofit`'s `StreamingToolkit`/`M365Tools.ts` adoption.

## Decision Log

Back-links, not copies — rationale lives in the exploration and sibling
packets:

| Decision | Where |
| --- | --- |
| Q7 two-layer enforcement (`EnabledWhen` + dispatch-boundary gate); original audit-into-`UsageRecord.metadata` intent | [`explorations/mcp-auth-gated-registration/DECISIONS.md`](../../explorations/mcp-auth-gated-registration/DECISIONS.md) |
| `mcp-write-wall` follow-on scope (real write-capable host, `UsageRecord.metadata` audit) | [`MAP.md`](../../explorations/mcp-auth-gated-registration/MAP.md) |
| Audit-sink deviation for this proving slice: log-only, persistence deferred | This `SPEC.md`'s Non-Goals + Exception Ledger (new decision, 2026-07-02, since `nlp-mcp` has no epistemic-domain dependency today) |
| `NlpToolkit`'s four stateful tools identified, correctly left unannotated/ungated as out-of-scope | [`goals/mcp-host-retrofit/PLAN.md`](../mcp-host-retrofit/PLAN.md) P0 row |
| `TierGate`'s fail-closed default (`isDestructive` → `true` when unannotated) | `packages/foundation/capability/mcp-kit/src/TierGate.ts:301-302` |
| `sanitizedToolkit`'s proven dispatch-interception seam | `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:206-223` |

## Acceptance Criteria

- [ ] `NlpToolkit`'s four stateful tools
      (`CreateCorpus`/`LearnCorpus`/`DeleteCorpus`/`LearnCustomEntities`)
      carry accurate, judged `Tool.Destructive`/read-only annotations.
- [ ] `NlpToolkit`'s remaining tools carry non-destructive annotations
      (mechanical, via `annotateFourHints`/`readOnlyToolHints`) so the gate
      does not fail-closed-refuse them.
- [ ] `nlp-mcp`'s dispatch path composes `@beep/mcp-kit`'s `TierGate`
      wrapper (`dispatchWithTierGate`/`fromApprovedToolsPolicy`) at the
      `tools/call` seam.
- [ ] Fixture test: an approved tool call dispatches and returns real
      `NlpToolkit`/`WinkNlpToolkitLive` output.
- [ ] Fixture test: a refused tool call never runs the underlying handler
      and returns a typed refusal with a `TierGateAuditRecord`.
- [ ] Every gated dispatch (approved or refused) produces a
      `TierGateAuditRecord`, logged rather than persisted, per this SPEC's
      Non-Goals.
- [ ] Existing `nlp-mcp` test suites pass unchanged in observable behavior
      for all previously-passing paths.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/mcp-write-wall/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/mcp-write-wall/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/mcp-write-wall` | Passes |
| Package tests + quality gates | `bun run beep yeet verify` | Green |

## Stop Conditions

- Required source files are missing or materially contradictory.
- `@beep/mcp-kit`'s shipped `TierGate`/`SanitizedSpan`/`ToolAnnotations`
  surface has drifted from the deliverable contracts cited above — stop and
  report; do not patch the kit beyond the additive, real-consumer-driven
  scope named in Non-Goals.
- Wiring the gate would require behavior changes to `NlpToolkit`'s tools
  themselves beyond annotation — stop and report rather than silently
  expanding scope.
- Annotating or gating a tool would require guessing at its real semantics
  without enough evidence to judge destructive vs non-destructive — stop and
  report the ambiguous tool rather than guessing.
- Verification would require a live network call, cost, or destructive
  production side effects.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Audit sink is log-only, not persisted to `UsageRecord.metadata`, for this proving slice | `TierGateAuditRecord` sink in `nlp-mcp` | `mcp-write-wall` | `packages/drivers/nlp-mcp` has no `@beep/epistemic-domain` or `@beep/epistemic-use-cases` dependency today; wiring persistence would add an unrelated dependency edge to a driver package that doesn't have one | Remove when a future goal gives `nlp-mcp` (or a successor write-capable host) a real epistemic-domain tie and wires `UsageRecord.metadata` persistence per Q7 |
