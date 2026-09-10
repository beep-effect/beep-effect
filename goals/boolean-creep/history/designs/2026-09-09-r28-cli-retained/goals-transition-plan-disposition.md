# Instance

- id: `goals-transition-plan-disposition`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketTransitionWriter.ts:270`
- symbol: `PacketTransitionPlan`
- members: `streamPresent`, `disposition`, `currentRevision`, `currentTip`, `events`, `derivedAfter`
- evidence: E3/E4 at `PacketTransitionWriter.ts:536-572` plus `PacketEventStore.ts:234-259` — the no-stream and sealed-plan writers allow an empty existing stream only on append and fix all six axes.

# Current shape

The transient plan repeats its three-way disposition with a stream-presence bit and carries broad optional/empty payloads. The no-stream writer emits false/streamless/revision zero/no tip/empty events/no derived state. A guarded stream may be empty (revision zero/no tip) or established (nonzero/tip). Skipped requires an established status and carries no new events. Append carries drafted events and `derivedAfter` from either empty or established streams.

# Cardinality gap

The boolean, three-way disposition, revision zero/nonzero, tip presence, event-list emptiness, and derived-state presence represent 192 tuples. Four are legal: streamless is false/streamless/zero/no tip/empty/no derived; skipped is true/skipped/nonzero/tip/empty/derived; append-empty is true/append/zero/no tip/nonempty/derived; append-established is true/append/nonzero/tip/nonempty/derived.

# Target schema

Replace the coarse plan literal with a private `PacketTransitionPlanDisposition` LiteralKit containing `streamless`, `skipped`, `append-empty`, and `append-established`. Streamless owns no tip/events/derived state. Skipped owns a positive revision, tip, and derived state. Append-empty fixes revision zero with no current tip and owns nonempty events/derived state; append-established owns a positive revision, current tip, nonempty events, and derived state. Keep request and trace path shared. Migrate the decoded constructors/readers atomically.

# Migration inventory

- `PacketTransitionWriter.ts:75-80,238-280` — replace the coarse plan literal, define the four cases, and update the exported decoded example.
- `PacketTransitionWriter.ts:403-405` — compare stream-backed plan revision/tip directly during CAS.
- `PacketTransitionWriter.ts:523-572` — construct exact streamless, skipped, append-empty, and append-established cases while preserving folded state and draft-event order.
- `PacketTransitionWriter.ts:631-683` — consume the exact plan payloads without optional extraction or empty-list assumptions.
- `SetStatus.ts:270,411-425` — preserve preview and commit behavior for skipped/append/streamless plans.
- `SetRiskTier.ts:76-91,129` — consume the append case's required tip/events/derived state and retain output.
- `test/goals-set-status-stream.test.ts:182-315,454` — migrate all plan assertions, including moved-stream refusal and event order.

# Guard-deletion accounting

Delete `streamPresent`, the streamless zero-revision field, optional `currentTip`, empty `events`, optional `derivedAfter`, their constructor writes, and downstream presence/emptiness guards. The cases own those facts. Keep the filesystem stream probe, guarded-stream validation, and CAS comparison because they establish the case and protect writes.

# Encoded-side impact

None. Plans are transient and neither printed nor persisted. The exported schema has no live encode/decode boundary requiring a legacy projection. Event JSONL, trace JSON, manifest bytes, requests, errors, and command output remain unchanged.

# Test impact

Use schema-derived arbitrary coverage for the four complete cases so generated values cannot recreate optional or empty payload combinations. Retain streamless no-op, fresh skip, stale-trace skip, append, risk-tier append, event ordering, and moved-stream refusal tests.

# Risk and sequencing

Land with the serial Tier 1 packet batch. Preserve planning as read-only, the exact event sequence, folded state, and CAS inputs; case construction must not trigger trace repair or event writes.
