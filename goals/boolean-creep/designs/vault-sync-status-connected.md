# Instance

- id: `vault-sync-status-connected`
- file:line: `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:69`
- symbol: `VaultSyncStatus`
- members: `connected`, `disconnectReason`
- evidence classes:
  - E3 — `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:78`: the field description says the reason is none while the upstream mirror probe reports connected.
  - E1 — `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1544`: `readStatus` copies `probe.connected` and `probe.disconnectReason` as a pair from one upstream probe.
  - E2 — `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:332-338`: the panel renders the disconnected note only under `!connected` and then matches the reason; it has no connected-with-reason arm.

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

# Cardinality gap

The decoded boolean plus optional reason represent twelve combinations. Current producers have six honest connectivity states:

- connected.
- disconnected with exactly one of the five current `DmsMirrorDisconnectReason` values.

Connected-with-reason is illegal. The wire boundary additionally admits one legacy encoding, `connected: false` with a missing or null reason, because an older sidecar predates `disconnectReason`. That compatibility encoding is not another decoded state: it normalizes to the existing `probe-failed` disconnected case, matching the panel's current conservative behavior. The newer `probedAt` value is orthogonal observation metadata and remains an `Option` on the enclosing status.

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

`S.Class` in Effect v4 accepts struct fields/a `Struct`, not an arbitrary transformed codec, so the decoded class is deliberately named `VaultSyncStatusValue` and the stable public `VaultSyncStatus` name belongs to the compatibility codec plus its derived type alias. `DmsMirrorConnection.cases.connected.make()` omits `state` because `S.tag("connected")` supplies it; its defaulted `rootRemoteId` is `None` after wire decoding because the existing vault-status JSON does not carry that internal probe detail. Current server construction uses `VaultSyncStatusValue.make({ connection: probe.connection, probedAt: probe.probedAt, ... })`. UI branches use `DmsMirrorConnection.match`/`.guards`, while the timestamp remains available to the retry-status UI.

# Migration inventory

Refreshed against current `main` on 2026-09-03. Preserve the newer `probedAt` wire key and force-refresh request path; neither belongs inside the connectivity union.

- `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:8-15` — import `DmsMirrorConnection`, `O`, and `SchemaTransformation` as needed; retain `Effect` for the optional-key decoding default.
- `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:38-59` — update the decode example to demonstrate that current JSON still has `connected`, `disconnectReason`, and `probedAt`, while the decoded read is `status.connection.state`.
- `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:65-116` — split the current declaration into the current/legacy encoded struct, decoded `VaultSyncStatusValue` class, and bidirectional `VaultSyncStatus` compatibility codec/type shown above; retain both missing-key defaults.
- `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:327-362` and `:379-407` — keep encoded examples on old keys, including `probedAt`, but change decoded reads from `.connected` to the connection union guard/state.
- `packages/documents/use-cases/src/aggregates/Sync/Sync.rpc.ts:103-107` and `:124-128` — continue using `VaultSyncStatus` as the success schema for `TriggerVaultSync` and `GetVaultSyncStatus`; no RPC declaration change is needed because the class codec preserves the encoded side.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:28-44` — import `VaultSyncStatusValue` for construction while retaining the `VaultSyncStatus` type used by the engine contract as needed.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1548-1563` — preserve cached-versus-refresh probe selection, replace `VaultSyncStatus.make` with `VaultSyncStatusValue.make`, replace the parallel pair with `connection: probe.connection`, and continue copying `probe.probedAt`; all count/provider/cursor fields remain unchanged.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:10-16` — import `DmsMirrorConnection`; `DmsMirrorDisconnectReason` and `O` remain needed only if `DisconnectedNote` keeps matching the reason payload directly.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:43-53` — change `ConnectionBadge` to accept `DmsMirrorConnection` (or its `state` literal) and render via the schema-derived union match, deleting the boolean prop.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:112-144` — make `DisconnectedNote` accept `DmsMirrorDisconnected`; match `reason` directly with the existing `DmsMirrorDisconnectReason.$match`, preserve the separate `probedAt` prop/display, and delete the runtime `Option` fallback because legacy absence is normalized by the codec.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:309` — delete the local boolean and consume `status.value.connection` directly through `DmsMirrorConnection.guards`/case narrowing; do not store another connection state in a model.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:328-338` — pass the union to the badge, render the note through the disconnected case, preserve `probedAt`, and disable the trigger unless the success value has the connected case.
- `packages/documents/use-cases/src/public.ts:43` — export `DmsMirrorConnection` and its case types for the client-safe decoded status.
- `packages/documents/use-cases/src/public.ts:71` and `packages/documents/use-cases/src/aggregates/Sync/index.ts:28` — `VaultSyncStatus` remains exported under the same schema/type name; no client consumer import rename is required. The server wildcard barrel also exposes `VaultSyncStatusValue` for the one construction site.

Whole-repository search found no other source read or write of `VaultSyncStatus.connected` or `.disconnectReason`.

# Guard-deletion accounting

- `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:72-78` — move the older-sidecar comment from a field-level invariant to the encoded transform and delete the decoded `connected`/Option coherence claim.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1554-1555` — delete the two-field projection from the single upstream probe and pass its connection union through, while keeping `probedAt` at line 1562.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:43-53` — delete both boolean branches in the badge (`className` and label) in favor of one exhaustive connection match.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:112-144` — delete the reason `Option` fallback and its comment-only invariant; older wire output is normalized once by the schema codec, while timestamp rendering remains unchanged.
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
4. Older-sidecar JSON with omitted or null `disconnectReason` and omitted `probedAt` still decodes because both keys have missing-key defaults. The transform normalizes the missing reason to `disconnected / probe-failed` and keeps the timestamp as `None`.
5. Re-encoding that legacy input upgrades it to canonical current JSON with `disconnectReason: "probe-failed"` and `probedAt: null`; old input acceptance is preserved, while all new output remains today's shape.
6. `TriggerVaultSyncRpc` and `GetVaultSyncStatusRpc` keep the transformed `VaultSyncStatus` as their success codec, while server construction uses `VaultSyncStatusValue`; internal `state`, `connection`, `reason`, and `rootRemoteId` keys never appear on the wire.
7. Malformed current JSON with `connected: true` plus a reason canonicalizes to connected with null reason rather than creating an illegal decoded value.

# Test impact

- `packages/documents/use-cases/test/Sync.test.ts:65-77` — keep `idleStatus` decoding from old JSON keys; decoded assertions use `DmsMirrorConnection.guards.disconnected(idleStatus.connection)` and the narrowed reason.
- `packages/documents/use-cases/test/Sync.test.ts:152-168` — preserve the exact encoded-object assertion. Add decoded-union assertions and retain the schema-derived round trip.
- `packages/documents/use-cases/test/Sync.test.ts:215` — in the engine-port test, replace the live `status.connected === false` assertion with the disconnected union guard and narrow its reason.
- `apps/professional-desktop/test/schema-parity.test.ts:175-218` — preserve both exact current encoded round trips, including `probedAt`. Change the legacy assertions from absent decoded fields to a disconnected case with reason `probe-failed` plus `probedAt: None`; assert re-encoding produces canonical current JSON.
- `apps/professional-desktop/test/vault-sync-disconnected-note.test.tsx:15-33` — make the fixture accept a `DmsMirrorConnection` or case input while still decoding through old JSON keys when testing the boundary; keep its timestamp parameter.
- `apps/professional-desktop/test/vault-sync-disconnected-note.test.tsx` — cover all five disconnected reasons and one connected case. Keep the reasonless older-sidecar test, but create it by decoding legacy JSON and assert it renders the probe-failed behavior without losing timestamp rendering.
- `packages/documents/server/test/VaultSyncEngine.test.ts:192-209` and `:510-525` — replace `.connected` assertions with the connected union guard.
- Add explicit malformed connected-with-reason canonicalization coverage so the decoded side is proven unable to carry the old incoherent combination.
- Because the panel badge, disconnected note, trigger, and conflict-review controls are gesture-bearing UI, run the `browser-qa-loop` through the portless desktop script and retain successful record -> extract -> judge evidence with `requiredCount: 0` for connected and all disconnected behaviors.

# Risk & sequencing

This Tier 2 wire change lands alone only after the merged
`dms-mirror-probe-connected` PR owns the shared union. It deletes that PR's
temporary projection to the old Vault fields. The main risk is allowing the
decoded `connection` object onto the RPC or dropping `probedAt`. Keep
`VaultSyncStatusEncoded` on the source side and retain exact old-shape tests,
including missing-key and timestamp cases. Verify the current Effect-v4
transformation against `.repos/effect` before landing.
