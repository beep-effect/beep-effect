# Instance

- id: `r2-domains-anthropic-turn-holding-after-failure`
- file:line: `packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts:84`
- symbol: `AnthropicTurnKernel.routeBlock`
- members: `holdingAfterFailure`, `buffered`
- evidence: E4 at `AnthropicTurnKernel.ts:92-118` — buffered valid blocks are
  written only after the holding latch becomes true; `not holding + non-empty
  buffer` is unreachable. The first failure creates the legal holding-empty
  phase before later valid blocks create holding-buffered.

# Current shape

The stream router allocates three sibling refs: failure reports, valid blocks
buffered after the first failure, and a boolean saying whether such a failure
has happened. Every valid slice reads the boolean before choosing immediate
emission or buffering. Every invalid slice sets it and appends a report. The
repair tail separately drains both arrays.

# Cardinality gap

The holding bit and buffered-payload presence represent four combinations;
three are legal: streaming, holding with no later valid block, and holding with
buffered blocks. A buffer cannot be non-empty while the router is streaming.
Failure reports are mandatory payload of either holding state.

# Target schema

Introduce a private annotated `AssistantBlockRouteState` tagged union:
`streaming` and `holding { failures: NonEmptyReadonlyArray<IssueReport>,
buffered: ReadonlyArray<IndexedBlock> }`. Store it in one `Ref`. On the first
invalid slice, atomically transition to `holding` with one report; subsequent
invalid slices append reports; valid slices either emit from `streaming` or
append to the holding buffer. The repair tail gets the one state and matches it
once. Use the existing `IssueReport` and `IndexedBlock` schema owners and
Effect collection helpers; do not introduce a hand-written predicate.

# Migration inventory

- `AnthropicTurnKernel.ts` imports — import the value-level `IndexedBlock`, the
  agents-server identity composer, and only the schema helpers needed for the
  private tagged union.
- `AnthropicTurnKernel.ts:78-120` — replace the three-ref route signature with
  one `Ref<AssistantBlockRouteState>` and exhaustive state updates.
- `AnthropicTurnKernel.ts:189-205` — initialize one streaming state and pass
  it through `routeBlock`.
- `AnthropicTurnKernel.ts:208-219` — match streaming to an empty tail and
  holding to repair/sort its failure and buffer payloads; preserve repair token
  accounting.
- `packages/agents/server/test/AnthropicTurnKernel.test.ts:120-330` — extend the
  deterministic provider cases across every transition and ordering boundary.
- Whole-package search found no external reader of these refs; the exported
  `AnthropicTurnKernel` service is the only runtime boundary.

# Guard-deletion accounting

Delete `holdingAfterFailure`, the separate `failures` and `buffered` refs, the
boolean read/branch, the unconditional latch write, both independent
`getAndSet` drains, and their implicit cross-ref coherence requirement. The
tagged union owns the only legal payload combinations.

# Encoded-side impact

None. The union is private stream-runtime state. Provider requests, streamed
tool deltas, assistant block encoding, repair requests/results, event order,
metrics, logs, token accounting, and `AgentTurnKernel` output remain unchanged.

# Test impact

Cover all-valid immediate streaming; invalid-first, invalid-middle, and
invalid-last; holding with zero and multiple later valid blocks; multiple
failures; repaired/valid original index ordering; repair failure; provider
failure; and final usage totals. Existing tests already provide deterministic
provider and repair layers. Run focused kernel/codec/repair tests and full
`@beep/agents-server` verification with the required patch changeset.

# Risk and sequencing

Land in Tier 1A with backend state. The state update must remain serialized in
the stream's `mapEffect` lane, and the first failure report must be installed in
the same Ref update that activates holding. Preserve immediate delivery before
the first invalid slice and exact ordering in the repair tail.
