Native P2 provisional replacement only. Frozen source HEAD
`93217d998f851e2e93d9864e2b5315552eaa58a7`, main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. The current design and its history
remain unchanged. Full source/fixture hashes, request boundaries and per-ID
coverage are in `data/design-refresh-2026-09-09-r28-cli-retained-qualified-gap-audit.md`. No implementation, test run or independent
P3 verdict is claimed. Parent must integrate and obtain replacement review.

# Instance

- id: `goals-transition-plan-disposition`
- exact source SHA: `93217d998f851e2e93d9864e2b5315552eaa58a7`
- corpus source SHA: `d1b4d769fbaffddd55717f3b1ba461897dd545c5`
- file:line: `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketTransitionWriter.ts:270`
- symbol: `PacketTransitionPlan`
- members: `streamPresent`, `disposition`, `currentTip`, `derivedAfter`
- evidence: E3/E4 at `PacketTransitionWriter.ts:536-572` plus `PacketEventStore.ts:234-259` — the no-stream and sealed-plan writers allow an empty existing stream only on append and fix the four finite members and their full payloads.

# Current shape

PacketTransitionPlan is the actual exported schema at
PacketTransitionWriter.ts266–280. It owns streamPresent:Boolean,
disposition:append|skipped|streamless, optional currentTip and optional
derivedAfter. Its required currentRevision, events, request and tracePath are
full payloads. Its only constructors are sealedPlan542 and streamless558;
the writer's plan methods return exact proposed operations. This is a returned
operation model, unlike the raw Goals request inputs corrected to D1.

An existing empty stream has revision0 and no tip; an established stream has
a tip. Both can append. Skipping an already-current status requires an
established stream. Streamless owns no derivedAfter, while sealed plans own
it. Fold/validation failures stay on the Effect error channel.

# Cardinality gap

The actual finite cluster is [streamPresent,disposition,currentTip,derivedAfter]:
2 ×3 ×2 ×2 = **24** declared combinations, with **4** supported projections:
false/streamless/absent/absent;
true/skipped/present/present;
true/append/absent/present;
true/append/present/present.
Required revision zero/nonzero and event-list emptiness do not multiply the
count. Their exact constraints remain payload fidelity obligations.

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

Delete streamPresent storage and its constructor assignments; replace
SetStatus preview's optional currentTip266 and derivedAfter280 handling and
SetRiskTier80/87 Option reconstructions with exhaustive case-owned payload
access. Migrate commit655–683 from the coarse disposition to the exact plan
cases; keep one CAS comparison403–405 with the full planned revision and tip.
The no-event/zero-revision facts may be encoded in case payloads, but required
arrays/counts were not separate Boolean members and receive no fabricated
'Boolean guard' credit. Keep the filesystem stream probe, fold integrity/fork
guards and CAS race failure because they establish or protect the operation.
Outcome traceWritten/tip deletion belongs only to its separate outcome design.

# Encoded-side impact

Plans have no live JSON/persisted encode/decode boundary. The schema is
exported from its source module and the source-only Goals test kit; package
exports explicitly block commands/Goals/PacketCore/*. Public named writer
methods and test-kit callers still require atomic decoded migration.
Preserve event JSON, trace bytes, manifest/README bytes, full typed requests,
error text, human preview/output and event ordering. Do not call this an
unexported schema or add a new package subpath.

# Test impact

Use schema-derived arbitrary coverage for the four complete cases so generated values cannot recreate optional or empty payload combinations. Retain streamless no-op, fresh skip, stale-trace skip, append, risk-tier append, event ordering, and moved-stream refusal tests.

# Risk

Tier1 packet-model change coordinated with the outcome migration. Preserve
planning as read-only, full derived state/request/event payloads and CAS inputs.
The exported service's generated operation plans may be migrated; no raw CLI
request validator is deleted. Full case/model fixtures and existing command
stream/CAS tests are implementation obligations, not executed evidence here.

Local Effect v4 schema APIs: `.repos/effect/packages/effect/src/Schema.ts:6105`
provides S.toTaggedUnion;6255 provides S.TaggedUnion. Use existing LiteralKit
values for discriminants, named schema classes/cases and derived S.is guards.
No hand-rolled literal-union replacement or opaque always-true validator.
