# Boolean-creep Round 26 design refresh: agent turn surfaces

Source reviewed: `7440cb8c4302ce64b87860069a464bafbf65f576`

Corpus `origin/main`: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`

## `agents-chat-turn-surface`: disqualify

The raw proposal treated presence of `streamingTurnAtom` and `turnErrorAtom` as a three-state idle/streaming/failed union. Full mutation and observation analysis proves all four Option-presence pairs are supported.

| streaming turn | turn error | supported source path |
| --- | --- | --- |
| None | None | initial state and successful reconciliation |
| Some | None | active streaming after `Chat.atoms.ts:945-946` and block updates at 1064-1066 |
| None | Some | typed failure and defect completion at 1074-1076 and 1134-1135 |
| Some | Some | interruption reconciliation and completed-refresh failure at 1178-1233 and 1261-1266 |

The combined-Some state is not merely an unobservable adjacent-write transient. On interruption, error messages are written at lines 1178-1195 or 1211-1219 while the streaming fallback remains present until line 1233, after asynchronous receipt polling and timeline refresh. On completed-turn refresh failure, error is set at line 1261 before the fallback is appended and streaming is cleared at 1266. The UI independently observes these atoms: `apps/professional-desktop/src/chat/ui/ChatTurnErrorToasts.tsx:25,53` reads and clears the error, while `Thread.atoms.ts:285` and `Thread.tsx:247` read/subscribe to streaming state. Dismissing a toast can therefore change combined-Some back to streaming-Some/error-None.

Start, typed failure, and defect paths also use sequential writes, but their ordering passes through 00 rather than 11: start clears error before installing streaming at 945-946, and failures clear streaming before setting error at 1074-1076 and 1134-1135. Refresh/interruption deliberately use the opposite lifetime because the completed/stopped local turn remains visible while persistence evidence is reconciled.

No larger correlated owner removes this independence. `turnGenerationAtom` is a stale-finalizer generation guard, per-thread `unreconciledTurnAtoms` retain completed local fallbacks, and timeline AsyncResult state comes from a separate durable refresh. Existing inventory already records `r3-domains-chat-turn-active-receipt-uncertain` and `r25-apps-streaming-turn-view-active` as independent. The two atoms are exported decoded UI state and are not serialized or persisted.

Recommended canonical disposition:

- id: `agents-chat-turn-surface`
- file: `packages/agents/client/src/Chat.atoms.ts`
- line: 508
- symbol: `Chat.atoms.turnSurface`
- kind: `sibling-state`
- members: `streamingTurnAtom`, `turnErrorAtom`
- status: `disqualified`
- disqualifier: D1 — active/local-fallback turn visibility and the latest toast error are independently observable; interruption and refresh-failure paths intentionally support combined Some

No `designs/agents-chat-turn-surface.md` was created because the instance is not qualified. A tagged payload union would erase the supported combined state and change interruption/refresh UX.

## `r2-domains-anthropic-turn-holding-after-failure`: qualify with corrected 8/5

The existing stable record remains qualified, but its current inventory and design undercount both the member set and reachable states. The complete owner is the three private Refs declared at `packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts:189-193` and passed together to `routeBlock` at 204.

Final corrected metadata:

- id: `r2-domains-anthropic-turn-holding-after-failure`
- file: `packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts`
- line: 84
- symbol: `AnthropicTurnKernel.routeBlock`
- kind: `sibling-state`
- members: `holdingAfterFailure`, `failures`, `buffered`
- status: `designed`
- evidence E4/E1: `AnthropicTurnKernel.ts:84-120,189-218`
- cardinality: representable 8, legal 5
- storage: `stored`
- exposure: `internal`
- target shape: `tagged-union`
- tier: 1

With bit order holding/failures/buffered, the reachable coarse tuples are 000, 100, 110, 111, and 101. The raw proposal omitted 101: `repairTail` clears failures at line 210 and buffered at 211 in two sequential Effect operations, so holding=true/failures-empty/buffered-nonempty exists between them. The prior design also incorrectly said failure reports were mandatory for every holding state; line 102 sets the holding latch before appending the first failure, making 100 reachable, and the two drains end at 100. There is no public observer, but reachability and interruption between Effects prevent claiming those states do not exist.

Qualification survives because every payload-bearing state with holding=false remains impossible. Failures are appended only after setting holding; buffered blocks are appended only after reading holding true. `Stream.mapEffect` serializes routing, and `Stream.concat(repairTail)` starts the drain only after validated input completes (`AnthropicTurnKernel.ts:198-240`).

The corrected design keeps the existing one-Ref direction: `streaming | holding { failures: NonEmptyArray<IssueReport>, buffered }`. The first failure transition becomes atomic. Repair atomically captures and resets the whole route state, eliminating the sequential-clear states rather than pretending they were absent. It preserves the logical order of repairing failures before merging buffered valid blocks, sorting by original index, setting repair token totals, mapping errors, and finalizing.

## Files and verification

Updated:

- `goals/boolean-creep/designs/r2-domains-anthropic-turn-holding-after-failure.md`
- `goals/boolean-creep/data/design-refresh-2026-09-09-agent-turn-surfaces.md`

Intentionally absent because disqualified:

- `goals/boolean-creep/designs/agents-chat-turn-surface.md`

No product source, tests, inventory, status, dependencies, generated files, or git refs were changed.
