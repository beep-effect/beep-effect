# Instance

- id: `r2-domains-anthropic-turn-holding-after-failure`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts:84`
- symbol: `AnthropicTurnKernel.routeBlock`
- members: `holdingAfterFailure`, `failures`, `buffered`
- evidence: E4/E1 at `AnthropicTurnKernel.ts:84-120,189-218` — payload arrays require the holding latch during routing, while sequential latch/append and repair drains expose five reachable coarse states rather than the earlier four-state claim.

# Current shape

The kernel allocates three private sibling Refs: failure reports, valid blocks buffered after the first failure, and a boolean holding latch (`AnthropicTurnKernel.ts:189-205`). `routeBlock` reads the latch for every valid slice, appends later valid blocks to `buffered`, and on invalid input sets the latch before appending an `IssueReport` to `failures` (`AnthropicTurnKernel.ts:81-120`). After `validated` completes, the concatenated repair tail separately drains failures and then buffered blocks before repair and ordered emission (`AnthropicTurnKernel.ts:208-240`).

The refs are private to one `streamTurn` invocation. No serialized, persisted, public, or provider-wire shape contains them. The public boundary remains the streamed `AssistantTurnBlockEvent` sequence followed by finalization or `TurnGenerationError`.

# Cardinality gap

Using bit order `holdingAfterFailure`, nonempty `failures`, nonempty `buffered`, three binary axes represent eight tuples. Five are reachable:

| holding | failures | buffered | source state |
| --- | --- | --- | --- |
| false | empty | empty | initial/all-valid streaming |
| true | empty | empty | after latch set before first failure append; also after both repair drains |
| true | nonempty | empty | first failure with no later valid block |
| true | nonempty | nonempty | failure followed by one or more valid buffered blocks |
| true | empty | nonempty | transiently after `getAndSet(failures, empty)` and before `getAndSet(buffered, empty)` |

The final row was omitted from the raw 8/4 proposal. The two `yield* Ref.getAndSet` calls at lines 210-211 are sequential Effect operations, so the row is a reachable state even though no current reader intentionally observes it. Likewise, the latch write at line 102 precedes the failure append and makes holding-empty reachable.

The three holding-false payload rows remain impossible: route code appends failures only after setting holding true and buffers valid blocks only after reading holding true. Therefore the corrected cardinality is **8 representable / 5 legal**, and qualification survives.

# Target schema

Introduce a private annotated `AssistantBlockRouteState` tagged union held in one Ref:

- `streaming`
- `holding { failures: NonEmptyReadonlyArray<IssueReport>, buffered: ReadonlyArray<IndexedBlock> }`

Use the existing `IssueReport` and `IndexedBlock` schema owners. Valid slices match the state: streaming emits immediately; holding appends to its buffer. Invalid slices atomically transition streaming to holding with the first failure or append another failure to holding.

At repair-tail start, perform one `Ref.getAndSet(routeState, streaming)` and match the captured state. Streaming produces an empty tail; holding repairs its nonempty failures and then merges repaired blocks with buffered valid blocks in original index order. This atomic drain deliberately removes the transient holding-with-empty-failures representations from the new state without changing any observable stream output.

# Migration inventory

- `AnthropicTurnKernel.ts` imports — add only the schema/identity helpers needed for the private tagged union and value-level existing payload owners.
- `AnthropicTurnKernel.ts:78-120` — replace the three-ref route signature with `Ref<AssistantBlockRouteState>` and exhaustive atomic updates; preserve validation metrics and log order.
- `AnthropicTurnKernel.ts:189-205` — initialize one streaming state and pass it to `routeBlock`; retain provider metadata and token refs.
- `AnthropicTurnKernel.ts:208-220` — replace sequential array drains with one state drain, then bind failure payload before buffered payload and preserve `repairInvalidBlocks`, token writes, sorting, and output order.
- `AnthropicTurnKernel.ts:222-240` — leave provider finalization, error mapping, and stream concatenation order unchanged.
- `packages/agents/server/test/AnthropicTurnKernel.test.ts:1-230` — extend deterministic provider and repair fixtures across every route/repair transition.

# Guard-deletion accounting

Delete `holdingAfterFailure`, the separate `failures` and `buffered` refs, `Ref.get(holdingAfterFailure)`, the latch set, both independent append operations, both sequential `getAndSet` drains, and the implicit cross-ref coherence assumptions in `routeBlock` and `repairTail`. One tagged Ref makes the first failure plus latch transition atomic and gives repair a coherent payload snapshot. No runtime invariant predicate or fallback boolean alias replaces them.

# Encoded-side impact

None. The state is private stream-runtime data. Preserve provider requests, incoming delta scanning, streamed block schemas, repair requests and responses, metrics, logs, repair token accounting, final usage, failure mapping, and event order. No JSON, persistence, database, RPC, or provider wire key changes.

# Test impact

Cover all-valid immediate streaming; invalid-first, invalid-middle, and invalid-last; holding with zero and multiple later valid blocks; multiple failures; repaired and already-valid index ordering; repair failure; provider failure; missing/invalid usage; and final token totals. Add a focused state-transition test or extracted transition-law test proving the new state admits only streaming and holding-with-nonempty-failures before the atomic drain. Preserve validation metric timing and the fact that no later valid block emits before repair after the first failure.

# Risk and sequencing

Tier 1 backend state. `Stream.mapEffect` currently serializes route effects and `Stream.concat(repairTail)` starts repair only after validated input completes; preserve both boundaries. The atomic drain must capture failures and buffered blocks together while maintaining the current logical repair order: failures are repaired first, then combined with already-valid buffered blocks and sorted. Preserve immediate emissions before the first invalid slice, error precedence, telemetry, and finalization.
