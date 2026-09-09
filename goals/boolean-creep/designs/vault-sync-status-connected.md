# Instance

- id: `vault-sync-status-connected`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:69`
- symbol: `VaultSyncStatus`
- members: `connected`, `disconnectReason`
- evidence classes:
  - E3 — `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:73-80`: the boundary schema defaults an omitted/null reason to `None` and documents that the reason is absent while the upstream mirror probe reports connected.
  - E1 — `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1552-1562`: `readStatus` constructs the status by copying `probe.connected`, `probe.disconnectReason`, and the orthogonal `probe.probedAt` from one upstream probe.
  - E2 — `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:309-338`: the panel derives action enablement from `connected` and renders the disconnected note only under `!connected`, where it consumes the reason; it has no connected-with-reason arm.

# Current shape

Live declaration at `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:65`:

```ts
export class VaultSyncStatus extends S.Class<VaultSyncStatus>($I`VaultSyncStatus`)(
  {
    conflictItems: NonNegativeInt.annotateKey({
      description: "Number of tracked items in the conflict reconciliation state.",
    }),
    connected: S.Boolean.annotateKey({
      description: "Whether the DMS mirror adapter can reach the provider.",
    }),
    // The encoded key is optional with a null decoding default: an older
    // sidecar that predates the field must still produce a decodable status
    // (missing key -> none), not an unavailable panel.
    disconnectReason: S.OptionFromNullOr(DmsMirrorDisconnectReason)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Why the provider is disconnected; none while the mirror probe reports connected.",
      }),
    currentItems: NonNegativeInt.annotateKey({
      description: "Number of tracked items in the current reconciliation state.",
    }),
    cursorPosition: S.OptionFromNullOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Opaque remote-event stream position; none before the cursor bootstraps.",
    }),
    errorItems: NonNegativeInt.annotateKey({
      description: "Number of tracked items in the error reconciliation state.",
    }),
    failedOperations: NonNegativeInt.annotateKey({
      description: "Number of outbox operations in the failed status.",
    }),
    openConflicts: NonNegativeInt.annotateKey({
      description: "Number of drift records awaiting review.",
    }),
    pendingItems: NonNegativeInt.annotateKey({
      description: "Number of tracked items in the pending reconciliation state.",
    }),
    probedAt: S.OptionFromNullOr(S.DateTimeUtcFromString)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "When the mirror probe last actually asked the provider; none when no probe has contacted it.",
      }),
    provider: DmsProvider.annotateKey({
      description: "DMS provider the status describes.",
    }),
    queuedOperations: NonNegativeInt.annotateKey({
      description: "Number of outbox operations in the queued status.",
    }),
  },
  $I.annote("VaultSyncStatus", {
    description: "Point-in-time vault sync status read model for one workspace mirror.",
  })
) {}
```

# Round-26 UI projection subsumption

The r26 raw
`r26-apps-vault-sync-status-success-connected` finding must not become a
second canonical owner or a second UI literal. At
`apps/professional-desktop/src/sync/VaultSyncPanel.tsx:299-311`, `status` is the
existing `AsyncResult<VaultSyncStatus, unknown>` value and `connected` is one
local Boolean. The proposed `status.success` sibling is not a field or local;
it is the result of calling `AsyncResult.isSuccess(status)` inline at line 309.
The raw 4/3 truth table correctly describes the conditional expression, but no
two-Boolean carrier exists in this scope.

The expression also crosses two existing case owners that the complete reader
graph must preserve:

- `AsyncResult` owns Initial, Failure, and Success plus its orthogonal waiting
  state. `VaultSyncStatusView` at `VaultSyncPanel.tsx:56-101` renders those
  variants and failure retry behavior directly.
- Within Success, the decoded `VaultSyncConnection` designed here owns
  connected versus optionally explained disconnected state. The provider and
  count readers still consume the enclosing successful status payload.

Creating `not-ready | disconnected | connected` would flatten those owners and
would not delete an invariant beyond the one `connected` local. The migration
already specified by this design is the complete repair: narrow the existing
AsyncResult, consume `status.value.connection` through schema-derived union
guards/matching, pass that union to the badge/note, and delete the local. Keep
Initial versus Failure, waiting, counts, provider, probe timestamp, and retry
behavior on their authoritative values.

Canonical recommendation: archive the r26 raw ID as subsumed/ineligible and add
its lines 309 and 332 as UI guard-deletion evidence for stable
`vault-sync-status-connected`. Its 4/3 projection is not additional canonical
cardinality. The stable Tier 2 owner's coarse cardinality remains 4/3 for
`connected` × reason presence, with seven specific decoded connection states.

# Cardinality gap

The inventory measures the boolean and reason-presence projection: two boolean
values times reason absent/present represent four coarse combinations. Three
are legal: connected without a reason, disconnected without a reason, and
disconnected with a reason. Connected-with-reason is illegal. Expanding the
present branch across the five current `DmsMirrorDisconnectReason` values
yields seven specific decoded states: one connected, one unexplained
disconnected, and five reasoned disconnected variants.

The reasonless disconnected state is current legitimate compatibility data,
not merely a malformed encoding: `connected: false` plus null or an omitted
reason decodes to that state and must re-encode to the old codec's canonical
null. The `probedAt` value is orthogonal observation metadata and remains an
`Option` on the enclosing status.

# Target schema

Define a Vault-specific root-free projection with an optional reason in its
disconnected case. This is a distinct read-model schema because the DMS probe
always knows the reason for disconnection, while the supported Vault wire also
admits reasonless disconnection and has never carried `rootRemoteId`. Reusing
the full probe union would either reject legitimate Vault input or admit
decoded data that its wire cannot encode. Reuse the authoritative
`DmsMirrorDisconnectReason` literal domain, keep the old object as the encoded
side, and transform it to a class whose decoded side contains one schema-owned
connection field.
The following uses live repository Effect v4 patterns (`S.decodeTo` plus
`SchemaTransformation.transform`) already present in `Verdict.ts:507-515`.

```ts
import { DmsMirrorDisconnectReason } from "./DmsMirror.ts"
import { Effect, SchemaTransformation } from "effect"

export const VaultSyncStatusEncoded = S.Struct({
  conflictItems: NonNegativeInt,
  connected: S.Boolean,
  disconnectReason: S.OptionFromNullOr(DmsMirrorDisconnectReason).pipe(
    S.withDecodingDefaultKey(Effect.succeed(null)),
    SchemaUtils.withNoneDefault
  ),
  currentItems: NonNegativeInt,
  cursorPosition: S.OptionFromNullOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  errorItems: NonNegativeInt,
  failedOperations: NonNegativeInt,
  openConflicts: NonNegativeInt,
  pendingItems: NonNegativeInt,
  probedAt: S.OptionFromNullOr(S.DateTimeUtcFromString).pipe(
    S.withDecodingDefaultKey(Effect.succeed(null)),
    SchemaUtils.withNoneDefault
  ),
  provider: DmsProvider,
  queuedOperations: NonNegativeInt,
}).pipe(
  $I.annoteSchema("VaultSyncStatusEncoded", {
    description: "Current and older-sidecar encoded vault sync status shape.",
  })
)

export class VaultSyncConnected extends S.Class<VaultSyncConnected>($I`VaultSyncConnected`)(
  { state: S.tag("connected") },
  $I.annote("VaultSyncConnected", {
    description: "A connected Vault sync read model with no probe-only root payload.",
  })
) {}

export class VaultSyncDisconnected extends S.Class<VaultSyncDisconnected>($I`VaultSyncDisconnected`)(
  {
    state: S.tag("disconnected"),
    reason: S.Option(DmsMirrorDisconnectReason).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("VaultSyncDisconnected", {
    description: "A disconnected Vault sync read model with its reason when known.",
  })
) {}

export const VaultSyncConnection = S.Union([VaultSyncConnected, VaultSyncDisconnected]).pipe(
  S.toTaggedUnion("state"),
  $I.annoteSchema("VaultSyncConnection", {
    description: "Root-free connected or optionally explained disconnected Vault sync state.",
  })
)
export type VaultSyncConnection = typeof VaultSyncConnection.Type

export class VaultSyncStatusValue extends S.Class<VaultSyncStatusValue>($I`VaultSyncStatusValue`)(
  {
    conflictItems: NonNegativeInt,
    connection: VaultSyncConnection,
    currentItems: NonNegativeInt,
    cursorPosition: S.Option(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    errorItems: NonNegativeInt,
    failedOperations: NonNegativeInt,
    openConflicts: NonNegativeInt,
    pendingItems: NonNegativeInt,
    probedAt: S.Option(S.DateTimeUtc).pipe(SchemaUtils.withNoneDefault),
    provider: DmsProvider,
    queuedOperations: NonNegativeInt,
  },
  $I.annote("VaultSyncStatusValue", {
    description: "Decoded vault sync status with one exhaustive mirror connection state.",
  })
) {}

export const VaultSyncStatus = VaultSyncStatusEncoded.pipe(
  S.decodeTo(
    VaultSyncStatusValue,
    SchemaTransformation.transform<
      typeof VaultSyncStatusValue.Encoded,
      typeof VaultSyncStatusEncoded.Type
    >({
      decode: ({ connected, disconnectReason, ...status }) => ({
        ...status,
        connection: connected
          ? VaultSyncConnection.cases.connected.make()
          : VaultSyncConnection.cases.disconnected.make({ reason: disconnectReason }),
      }),
      encode: ({ connection, ...status }) =>
        VaultSyncConnection.match(connection, {
          connected: () => ({ ...status, connected: true, disconnectReason: O.none() }),
          disconnected: ({ reason }) => ({ ...status, connected: false, disconnectReason: reason }),
        }),
    })
  ),
  $I.annoteSchema("VaultSyncStatus", {
    description: "Wire-compatible vault sync status decoded to one exhaustive mirror connection state.",
  })
)
export type VaultSyncStatus = typeof VaultSyncStatus.Type
```

`S.Class` in Effect v4 accepts struct fields/a `Struct`, not an arbitrary transformed codec, so the decoded class is deliberately named `VaultSyncStatusValue` and the stable public `VaultSyncStatus` name belongs to the compatibility codec plus its derived type alias. Both tagged constructors omit `state` because `S.tag(...)` supplies it. The root-free `VaultSyncConnected` schema makes unsupported `rootRemoteId` unrepresentable instead of relying on a prose constraint or a lossy encoder. `VaultSyncDisconnected` keeps `reason: Option<DmsMirrorDisconnectReason>`, so null/missing and all five reason literals are exact transform cases without weakening the internal DMS probe union. `VaultSyncStatusEncoded` is exported only through the server aggregate barrel as the exact old-shape reference codec for compatibility tests; the client-safe public barrel continues to expose `VaultSyncStatus`. UI branches use `VaultSyncConnection.match`/`.guards`, while the timestamp remains available to the retry-status UI.

# Migration inventory

Refreshed against checkout source SHA
`7440cb8c4302ce64b87860069a464bafbf65f576` and packages/apps corpus SHA
`9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1` on 2026-09-09. Preserve the
`probedAt` wire key and force-refresh request path; neither belongs inside the
connectivity union. Upstream advanced after this frozen audit, so implementation
must refresh source lines and recheck the encoded declaration immediately
before apply.

- `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:8-15` — retain `DmsMirrorDisconnectReason`, import `O` and `SchemaTransformation` as needed, and retain `Effect` for the optional-key decoding default.
- `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:38-59` — update the decode example to demonstrate that current JSON still has `connected`, `disconnectReason`, and `probedAt`, while the decoded read is `status.connection.state`.
- `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:65-116` — split the current declaration into the current/legacy encoded struct, root-free `VaultSyncConnected` / `VaultSyncDisconnected` members and `VaultSyncConnection`, decoded `VaultSyncStatusValue` class, and bidirectional `VaultSyncStatus` compatibility codec/type shown above; retain both missing-key defaults and the disconnected `Option` reason. Export `VaultSyncStatusEncoded` through the server aggregate barrel only so tests can compute the old codec's canonical encoding without duplicating the boundary schema.
- `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:327-362` and `:379-407` — keep encoded examples on old keys, including `probedAt`, but change decoded reads from `.connected` to the connection union guard/state.
- `packages/documents/use-cases/src/aggregates/Sync/Sync.rpc.ts:103-107` and `:124-128` — continue using `VaultSyncStatus` as the success schema for `TriggerVaultSync` and `GetVaultSyncStatus`; no RPC declaration change is needed because the class codec preserves the encoded side.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:28-44` — import `VaultSyncStatusValue` for construction while retaining the `VaultSyncStatus` type used by the engine contract as needed.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1548-1564` — preserve cached-versus-refresh probe selection, replace `VaultSyncStatus.make` with `VaultSyncStatusValue.make`, and exhaustively project `probe.connection` to `VaultSyncConnection`: wrap the DMS disconnected reason in `Some` and construct the payload-free connected case, making probe-only `rootRemoteId` structurally unavailable. Continue copying `probe.probedAt`; all count/provider/cursor fields remain unchanged.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:10-16` — import `VaultSyncConnection`; retain `DmsMirrorDisconnectReason` and `O` because `DisconnectedNote` must preserve its conservative display fallback for a reasonless disconnected case.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:43-53` — change `ConnectionBadge` to accept `VaultSyncConnection` (or its `state` literal) and render via the schema-derived union match, deleting the boolean prop.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:112-144` — make `DisconnectedNote` accept the narrowed disconnected connection or its `Option` reason; preserve `O.match` so `None` continues to render the existing generic probe-failure guidance, match `Some(reason)` with `DmsMirrorDisconnectReason.$match`, and preserve the separate `probedAt` prop/display.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:309` — delete the local boolean and consume `status.value.connection` directly through `VaultSyncConnection.guards`/case narrowing; do not store another connection state in a model.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:328-338` — pass the union to the badge, render the note through the disconnected case, preserve `probedAt`, and disable the trigger unless the success value has the connected case.
- `packages/documents/use-cases/src/public.ts` and `aggregates/Sync/index.ts` — export `VaultSyncConnected`, `VaultSyncDisconnected`, `VaultSyncConnection`, and their derived types alongside `VaultSyncStatus`; do not expose the probe-only connection with `rootRemoteId` through the client-safe barrel.
- `packages/documents/use-cases/src/public.ts:71` and `packages/documents/use-cases/src/aggregates/Sync/index.ts:28` — `VaultSyncStatus` remains exported under the same schema/type name; no client consumer import rename is required. The server wildcard barrel also exposes `VaultSyncStatusValue` for the one construction site.

Whole-repository search found no other source read or write of `VaultSyncStatus.connected` or `.disconnectReason`.

# Guard-deletion accounting

- `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:72-78` — move the older-sidecar comment from a field-level invariant to the encoded transform and delete the decoded `connected`/Option coherence claim.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1554-1555` — delete the two-field projection from the single upstream probe and replace it with one exhaustive conversion into the root-free `VaultSyncConnection`, while keeping `probedAt` at line 1562.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:43-53` — delete both boolean branches in the badge (`className` and label) in favor of one exhaustive connection match.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:112-144` — retain the reason `Option` fallback because `None` is legitimate compatibility data, but delete the need to coordinate it with a separate `connected` boolean; the disconnected case owns the option and timestamp rendering remains unchanged.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:309` and `:332-335` — delete the repeated `AsyncResult success && connected` / `success && !connected` coherence checks; narrow once to the union case.

# Encoded-side impact

Tier 2 compatibility design: keep today's wire JSON unchanged.

The encoded side remains:

```ts
{
  conflictItems: number
  connected: boolean
  disconnectReason?: "credentials-missing" | "auth-failed" | "root-unreachable" | "transient" | "probe-failed" | null
  currentItems: number
  cursorPosition: string | null
  errorItems: number
  failedOperations: number
  openConflicts: number
  pendingItems: number
  probedAt?: string | null
  provider: "box"
  queuedOperations: number
}
```

Compatibility proof sketch:

1. Current connected JSON (`connected: true`, null reason) decodes to the connected union case and re-encodes with the same two keys and values.
2. Current disconnected JSON with any of the five known reasons decodes to the disconnected case and re-encodes with `connected: false` and the same reason.
3. Current `probedAt` strings decode to the same `DateTime.Utc` value and re-encode to the same timestamp; null remains `None`/null.
4. Current `connected: false, disconnectReason: null` decodes to the disconnected case with `reason: None` and re-encodes with null unchanged. It must never be rewritten to `probe-failed`.
5. Older-sidecar JSON with omitted `disconnectReason` and/or `probedAt` still decodes because both keys retain their missing-key null defaults. Re-encoding produces exactly the old codec's canonical encoding: the omitted key becomes null, never a fabricated reason or timestamp.
6. For every legitimate row—connected/null, disconnected/null, and disconnected with each of the five reasons—assert `encodeNew(decodeNew(input))` equals `encodeOld(decodeOld(input))`. Run the same comparison with present/null and omitted optional keys and with present/omitted `probedAt`.
7. `TriggerVaultSyncRpc` and `GetVaultSyncStatusRpc` keep the transformed `VaultSyncStatus` as their success codec, while server construction uses `VaultSyncStatusValue`; internal `state`, `connection`, and `reason` keys never appear on the wire.
8. The payload-free `VaultSyncConnected` schema makes `rootRemoteId` unrepresentable in the Vault decoded model and wire payload; only the internal DMS probe connected case owns that field.
9. Incoherent but previously accepted JSON with `connected: true` plus a reason remains accepted and canonicalizes to connected with null reason rather than creating an illegal decoded value. This normalization is tested separately and is not counted as a legitimate round-trip row.

# Test impact

- `packages/documents/use-cases/test/Sync.test.ts:65-77` — keep `idleStatus` decoding from old JSON keys; decoded assertions use `VaultSyncConnection.guards.disconnected(idleStatus.connection)` and assert its narrowed `Some("credentials-missing")` reason.
- `packages/documents/use-cases/test/Sync.test.ts:152-173` — preserve the exact encoded-object assertion and add decoded-union assertions. The root-free Vault schema restores a true decoded arbitrary round trip, including `reason: None` and all five `Some(reason)` rows; retain the schema-derived round trip.
- Add a compatibility table that decodes and re-encodes connected/null, disconnected/null, and disconnected with all five reasons through exported server-only `VaultSyncStatusEncoded` and the new `VaultSyncStatus`, then compares their canonical encoded outputs exactly. Repeat the null rows with `disconnectReason` omitted and the timestamp rows with `probedAt` present, null, and omitted.
- `packages/documents/use-cases/test/Sync.test.ts:215` — in the engine-port test, replace the live `status.connected === false` assertion with the disconnected union guard and narrow its reason.
- `apps/professional-desktop/test/schema-parity.test.ts:175-218` — preserve both exact current encoded round trips, including `probedAt`. Change the legacy assertions to a disconnected case with `reason: None` plus `probedAt: None`; assert re-encoding equals the old codec's canonical object with null reason and timestamp rather than `probe-failed`.
- `apps/professional-desktop/test/vault-sync-disconnected-note.test.tsx:15-33` — make the fixture accept a `VaultSyncConnection` or case input while still decoding through old JSON keys when testing the boundary; keep its timestamp parameter.
- `apps/professional-desktop/test/vault-sync-disconnected-note.test.tsx` — cover all five disconnected reasons and one connected case. Keep the reasonless older-sidecar test by decoding legacy JSON, assert the decoded disconnected reason remains `None`, and assert the existing generic probe-failure guidance and timestamp behavior remain unchanged.
- `packages/documents/server/test/VaultSyncEngine.test.ts:192-209` and `:510-525` — replace `.connected` assertions with the connected union guard.
- Add explicit malformed connected-with-reason acceptance and canonicalization coverage so the decoded side is proven unable to carry the old incoherent combination without tightening the accepted encoded input set.
- Because the panel badge, disconnected note, trigger, and conflict-review controls are gesture-bearing UI, run the `browser-qa-loop` through the portless desktop script and retain successful record -> extract -> judge evidence with `requiredCount: 0` for connected and all disconnected behaviors.

# Risk & sequencing

This Tier 2 wire change lands alone only after the merged
`dms-mirror-probe-connected` PR owns the shared union. It deletes that PR's
temporary projection to the old Vault fields. The main risks are rewriting a
legitimate null reason, leaking the decoded `connection` object onto the wire,
or dropping `probedAt`. Keep
`VaultSyncStatusEncoded` on the source side and retain exact old-shape tests,
including comparisons with the old codec's canonical encoding for missing-key,
null-reason, all-five-reason, and timestamp cases. Verify the current Effect-v4
transformation against `.repos/effect` before landing.
