# Instance

- id: `vault-sync-status-connected`
- file:line: `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:69`
- symbol: `VaultSyncStatus`
- members: `connected`, `disconnectReason`
- evidence classes:
  - E3 — `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:78`: the field description says the reason is none while the upstream mirror probe reports connected.
  - E1 — `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1544`: `readStatus` copies `probe.connected` and `probe.disconnectReason` as a pair from one upstream probe.
  - E2 — `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:290`: the panel renders the disconnected note only under `!connected` and then matches the reason; it has no connected-with-reason arm.

# Current shape

Live declaration at `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:64`:

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

# Cardinality gap

The decoded boolean plus optional reason represent four combinations. Current producers have three honest states:

- connected.
- disconnected because credentials are missing.
- disconnected because the provider probe failed.

Connected-with-reason is illegal. The wire boundary additionally admits one legacy encoding, `connected: false` with a missing or null reason, because an older sidecar predates `disconnectReason`. That compatibility encoding is not a fourth decoded state: it normalizes to the existing `probe-failed` disconnected case, matching the panel's current conservative behavior at `VaultSyncPanel.tsx:135-150`.

# Target schema

Reuse the exact `DmsMirrorConnection` tagged union designed by `dms-mirror-probe-connected`; do not define another connectivity domain. Keep the old object as the encoded side and transform it to a class whose decoded side contains one `connection` field. The following uses live repository Effect v4 patterns (`S.decodeTo` plus `SchemaTransformation.transform`) already present in `Verdict.ts:425-436`.

```ts
import { DmsMirrorConnection } from "./DmsMirror.ts"
import { Effect, SchemaTransformation } from "effect"

const VaultSyncStatusEncoded = S.Struct({
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
  provider: DmsProvider,
  queuedOperations: NonNegativeInt,
}).pipe(
  $I.annoteSchema("VaultSyncStatusEncoded", {
    description: "Current and older-sidecar encoded vault sync status shape.",
  })
)

export class VaultSyncStatusValue extends S.Class<VaultSyncStatusValue>($I`VaultSyncStatusValue`)(
  {
    conflictItems: NonNegativeInt,
    connection: DmsMirrorConnection,
    currentItems: NonNegativeInt,
    cursorPosition: S.Option(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    errorItems: NonNegativeInt,
    failedOperations: NonNegativeInt,
    openConflicts: NonNegativeInt,
    pendingItems: NonNegativeInt,
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
          ? DmsMirrorConnection.cases.connected.make()
          : DmsMirrorConnection.cases.disconnected.make({
              reason: O.getOrElse(disconnectReason, () => DmsMirrorDisconnectReason.Enum["probe-failed"]),
            }),
      }),
      encode: ({ connection, ...status }) =>
        DmsMirrorConnection.match(connection, {
          connected: () => ({ ...status, connected: true, disconnectReason: O.none() }),
          disconnected: ({ reason }) => ({ ...status, connected: false, disconnectReason: O.some(reason) }),
        }),
    })
  ),
  $I.annoteSchema("VaultSyncStatus", {
    description: "Wire-compatible vault sync status decoded to one exhaustive mirror connection state.",
  })
)
export type VaultSyncStatus = typeof VaultSyncStatus.Type
```

`S.Class` in Effect v4 accepts struct fields/a `Struct`, not an arbitrary transformed codec, so the decoded class is deliberately named `VaultSyncStatusValue` and the stable public `VaultSyncStatus` name belongs to the compatibility codec plus its derived type alias. `DmsMirrorConnection.cases.connected.make()` omits `state` because `S.tag("connected")` supplies it; its defaulted `rootRemoteId` is `None` after wire decoding because the existing vault-status JSON does not carry that internal probe detail. Current server construction uses `VaultSyncStatusValue.make({ connection: probe.connection, ... })`. UI branches use `DmsMirrorConnection.match`/`.guards`.

# Migration inventory

- `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:8-15` — import `DmsMirrorConnection`, `O`, and `SchemaTransformation` as needed; retain `Effect` for the optional-key decoding default.
- `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:36-59` — update the decode example to demonstrate that old JSON still has `connected`/`disconnectReason`, while the decoded read is `status.connection.state`.
- `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:64-108` — split the current declaration into the legacy/current encoded struct, decoded `VaultSyncStatusValue` class, and bidirectional `VaultSyncStatus` compatibility codec/type shown above.
- `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:319-350` and `:376-385` — keep encoded examples on old keys, but change decoded reads from `.connected` to the connection union guard/state.
- `packages/documents/use-cases/src/aggregates/Sync/Sync.rpc.ts:103-107` and `:124-128` — continue using `VaultSyncStatus` as the success schema for `TriggerVaultSync` and `GetVaultSyncStatus`; no RPC declaration change is needed because the class codec preserves the encoded side.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:28-44` — import `VaultSyncStatusValue` for construction while retaining the `VaultSyncStatus` type used by the engine contract as needed.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1538-1554` — replace `VaultSyncStatus.make` with `VaultSyncStatusValue.make` and the parallel pair with `connection: probe.connection`; all count/provider/cursor fields remain unchanged.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:10-13` — import `DmsMirrorConnection`; `DmsMirrorDisconnectReason` and `O` remain needed only if `DisconnectedNote` keeps matching the reason payload directly.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:38-48` — change `ConnectionBadge` to accept `DmsMirrorConnection` (or its `state` literal) and render via the schema-derived union match, deleting the boolean prop.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:98-152` — make `DisconnectedNote` accept `DmsMirrorDisconnected`; match `reason` directly with the existing `DmsMirrorDisconnectReason.$match`. Delete the runtime `Option` fallback because legacy absence is normalized by the codec.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:267` — replace the local boolean with `const connection = O.map(status.value, ...)` only if useful, or derive `connected` solely as a local UI boolean through `DmsMirrorConnection.guards.connected`; do not store it in a model.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:286-298` — pass the union to the badge, render the note through the disconnected case, and disable the trigger unless the success value has the connected case.
- `packages/documents/use-cases/src/public.ts:43` — export `DmsMirrorConnection` and its case types for the client-safe decoded status.
- `packages/documents/use-cases/src/public.ts:71` and `packages/documents/use-cases/src/aggregates/Sync/index.ts:28` — `VaultSyncStatus` remains exported under the same schema/type name; no client consumer import rename is required. The server wildcard barrel also exposes `VaultSyncStatusValue` for the one construction site.

Whole-repository search found no other source read or write of `VaultSyncStatus.connected` or `.disconnectReason`.

# Guard-deletion accounting

- `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:72-78` — move the older-sidecar comment from a field-level invariant to the encoded transform and delete the decoded `connected`/Option coherence claim.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1544-1545` — delete the two-field projection from the single upstream probe and pass its connection union through.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:38-48` — delete both boolean branches in the badge (`className` and label) in favor of one exhaustive connection match.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:135-152` — delete the `O.match` legacy normalizer and its comment-only reasonless invariant; older wire output is normalized once by the schema codec.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:267` and `:290-291` — delete the repeated `AsyncResult success && connected` / `success && !connected` coherence checks; narrow once to the union case.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:298` — delete the second negated connected check for trigger disablement and derive it from the same narrowed connection case.

# Encoded-side impact

Tier 2 compatibility design: keep today's wire JSON unchanged.

The encoded side remains:

```ts
{
  conflictItems: number
  connected: boolean
  disconnectReason?: "credentials-missing" | "probe-failed" | null
  currentItems: number
  cursorPosition: string | null
  errorItems: number
  failedOperations: number
  openConflicts: number
  pendingItems: number
  provider: "box"
  queuedOperations: number
}
```

Compatibility proof sketch:

1. Current connected JSON (`connected: true`, null reason) decodes to the connected union case and re-encodes with the same two keys and values.
2. Current disconnected JSON with either known reason decodes to the disconnected case and re-encodes with `connected: false` and the same reason.
3. Older-sidecar JSON with `connected: false` and an omitted or null reason still decodes because `withDecodingDefaultKey` supplies null/`None`; the transform normalizes it to `disconnected / probe-failed`, exactly matching the current UI fallback at `VaultSyncPanel.tsx:135-150`.
4. Re-encoding that legacy input upgrades it to the canonical current JSON with `disconnectReason: "probe-failed"`; old input acceptance is preserved, while all new output remains today's shape.
5. `TriggerVaultSyncRpc` and `GetVaultSyncStatusRpc` keep the transformed `VaultSyncStatus` as their success codec, while server construction uses `VaultSyncStatusValue`; internal `state`, `connection`, `reason`, and `rootRemoteId` keys never appear on the wire.
6. Malformed current JSON with `connected: true` plus a reason canonicalizes to connected with null reason rather than creating an illegal decoded value.

# Test impact

- `packages/documents/use-cases/test/Sync.test.ts:65-77` — keep `idleStatus` decoding from old JSON keys; decoded assertions use `DmsMirrorConnection.guards.disconnected(idleStatus.connection)` and the narrowed reason.
- `packages/documents/use-cases/test/Sync.test.ts:152-168` — preserve the exact encoded-object assertion. Add decoded-union assertions and retain the schema-derived round trip.
- `packages/documents/use-cases/test/Sync.test.ts:190-205` — replace `status.connected === false` with the disconnected union guard.
- `apps/professional-desktop/test/schema-parity.test.ts:163-200` — preserve both exact current encoded round trips. Change the legacy assertion from `O.isNone(legacyStatus.disconnectReason)` to a disconnected case with reason `probe-failed`; also assert re-encoding produces canonical current JSON.
- `apps/professional-desktop/test/vault-sync-disconnected-note.test.tsx:14-27` — make the fixture accept a `DmsMirrorConnection` or case input while still decoding through old JSON keys when testing the boundary.
- `apps/professional-desktop/test/vault-sync-disconnected-note.test.tsx:41-80` — use the two disconnected cases and one connected case. Keep the reasonless older-sidecar test, but create it by decoding legacy JSON and assert it renders the probe-failed behavior.
- `packages/documents/server/test/VaultSyncEngine.test.ts:192-209` and `:510-525` — replace `.connected` assertions with the connected union guard.
- Add explicit malformed connected-with-reason canonicalization coverage so the decoded side is proven unable to carry the old incoherent combination.

# Risk & sequencing

This Tier 2 wire change must land alone after, or atomically with, `dms-mirror-probe-connected`, which owns the shared union. The main risk is accidentally allowing the decoded `connection` object to become the RPC encoding. Keep `VaultSyncStatusEncoded` on the source side of the class transformation and retain exact old-shape assertions in both use-case and desktop schema-parity tests. The local `.repos/effect` reference checkout was absent during design; the cited `S.decodeTo`/`SchemaTransformation.transform` form was verified against this checkout's installed Effect v4 source and the live `Verdict.ts` precedent, so the apply agent should still typecheck the exact class-over-transformation generic inference before landing.
