# Instance

- id: `receipt-fallback-draft-occupancy`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/agents/client/src/Chat.atoms.ts:1019`
- symbol: `reconcileReceiptFallbacks.draftRestoration`
- members: `currentDraftOccupied`, `draftToRestore`
- evidence: E4 at `Chat.atoms.ts:1019-1033` — the lazy fallback
  selection writes `draftToRestore` only after both the current-draft occupancy
  and the existing restore candidate are absent, so both-present is unreachable.

# Current shape

Receipt reconciliation snapshots whether the composer draft is occupied as
`Option<true>` and separately initializes a mutable
`Option<StreamingTurn>` restore candidate. For each `not_persisted` fallback,
an occupied composer retains the fallback; an existing selected candidate also
retains it; otherwise the first candidate is removed from the fallback list and
saved for restoration. After the filter, its exact `userContent` is installed
as the draft and the draft revision increments once.

The two Options have different payload roles. The occupancy Option is only a
snapshot signal; the restore Option must retain the complete selected
`StreamingTurn`. Reducing both to an option-literal would discard the payload
needed at lines 1048-1050.

# Cardinality gap

At the presence level four pairs are representable and three are reachable:

| current draft occupied | restore candidate | state |
| --- | --- | --- |
| absent | absent | available |
| present | absent | blocked by current draft |
| absent | present | selected, carrying `StreamingTurn` |

Present/present is unreachable. `currentDraftOccupied` is never reassigned,
and `O.orElse`/`O.getOrElse` evaluate the restore writer only after the
occupancy path and existing candidate are both absent.

# Target schema

Define one private `DraftRestorationState` union with `available`, `occupied`,
and `selected { turn: StreamingTurn }` cases. Initialize it once from the draft
snapshot. In the serial filter, `available` selects and carries the first
`not_persisted` fallback; `occupied` and `selected` retain later fallbacks.
Afterward, restore only the selected payload.

Reuse the existing `StreamingTurn` schema as the payload owner. Do not create a
new draft or turn schema, flatten the turn to `userContent`, or retain the two
presence bits in a helper.

# Migration inventory

- `packages/agents/client/src/Chat.atoms.ts:41-48,400-470` — reuse the existing
  reconciliation LiteralKit and `StreamingTurn`; neither encoded model changes.
- `Chat.atoms.ts:998-1020` — add the private local union and initialize one
  restoration state from the current draft snapshot after receipt status reads.
- `Chat.atoms.ts:1021-1047` — match the state in the existing serial filter.
  Preserve decision lookup by object identity, status matching, unknown-status
  retention, and fallbacks appended while receipt reads were in flight.
- `Chat.atoms.ts:1048-1052` — restore exact selected `userContent`, increment
  the same per-thread draft revision once, and publish the retained fallbacks in
  the same order.
- `packages/agents/client/test/run-turn-reconciliation.test.ts:608-725` —
  retain the complete multi-fallback, occupied-draft, concurrent-draft-update,
  and appended-fallback scenarios.
- `run-turn-reconciliation.test.ts:357-405` — retain isolated persisted versus
  not-persisted restoration coverage and exact revision behavior.

Targeted source and barrel search found no other reader or writer of these two
local Options.

# Guard-deletion accounting

Delete `currentDraftOccupied`, `draftToRestore`, both presence projections to
`true`, the nested `O.orElse`/`O.getOrElse` occupancy wall, the mutable Option
assignment, and the final `O.toArray` loop. One exhaustive local state match
owns availability, blocking, selection, and the selected payload. Keep the
receipt-status Option handling because missing status legitimately retains a
fallback and is outside this occupancy cluster.

# Encoded-side impact

None. The owner is mutable transient state inside one synchronous reconciliation
block. `StreamingTurn` remains unchanged and the selected instance is carried
without encoding or reconstruction. Preserve atom values, exact user document,
request and reconciliation metadata, block ordering, fallback ordering, and
draft revision values. No compatibility transform or new stored atom is needed.

# Test impact

Assert all three states through behavior: empty draft selects the first
not-persisted fallback and retains later ones; occupied draft selects none and
retains all; once selected, later candidates remain retained. Preserve the
test where a newer draft appears while receipt reads are in flight, the test
where a fallback is appended during those reads, persisted/user-persisted
retirement, pending/accepted/unknown retention, and absent-status retention.
Assert exact restored document identity and a single revision increment. No
browser QA is required for this atom-only state transition.

# Risk and sequencing

Tier 1 internal stored-state refactor. The filter must remain serial and the
current-draft snapshot must be taken after asynchronous receipt reads, exactly
as today. Moving the snapshot earlier, restoring more than one fallback,
copying only part of `StreamingTurn`, or changing retained-array order would
alter reconciliation behavior. The owner, restoration writer, and complete
caller graph were rechecked at the exact source SHA above.
