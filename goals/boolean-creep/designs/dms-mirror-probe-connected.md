# Instance

- id: `dms-mirror-probe-connected`
- file:line: `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:568`
- symbol: `DmsMirrorProbe`
- members: `connected`, `disconnectReason`
- evidence classes:
  - E3 — `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:548`: the JSDoc states that `disconnectReason` is none while connected and carries a reason while disconnected.
  - E1 — `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:796`: failure writes `connected: false` with `probe-failed`; success at line 803 writes `connected: true` with no reason. The app disconnected layer writes the credentials-missing case.

# Current shape

Live declaration at `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:566`:

```ts
export class DmsMirrorProbe extends S.Class<DmsMirrorProbe>($I`DmsMirrorProbe`)(
  {
    connected: S.Boolean.annotateKey({
      description: "Whether the mirror adapter can reach the provider.",
    }),
    disconnectReason: S.Option(DmsMirrorDisconnectReason).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Why the provider is disconnected; none while the probe reports connected.",
    }),
    provider: DmsProvider.annotateKey({
      description: "DMS provider the probe describes.",
    }),
    rootRemoteId: S.Option(RemoteItemId).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Provider identifier of the resolved mirror-root folder; none when it could not be resolved.",
    }),
  },
  $I.annote("DmsMirrorProbe", {
    description: "Connectivity probe result for one DMS mirror adapter.",
  })
) {}
```

# Cardinality gap

The boolean plus optional reason represent four combinations before considering `rootRemoteId`. Three connectivity states are legal:

- connected, with an optional resolved `rootRemoteId`.
- disconnected because `credentials-missing`, with no root id.
- disconnected because `probe-failed`, with no root id.

`connected` with a reason is illegal. A disconnected probe with no reason is not produced inside this internal port, and a disconnected probe cannot honestly carry a resolved root id. The older reasonless wire case belongs only to `VaultSyncStatus` decoding and is normalized at that boundary.

# Target schema

Define the shared connection union in `DmsMirror.ts` and reuse it unchanged in the sibling `vault-sync-status-connected` design. The existing `DmsMirrorDisconnectReason` `LiteralKit` is authoritative; do not mint a duplicate.

```ts
export class DmsMirrorConnected extends S.Class<DmsMirrorConnected>($I`DmsMirrorConnected`)(
  {
    state: S.tag("connected"),
    rootRemoteId: S.Option(RemoteItemId).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Provider identifier of the resolved mirror-root folder, when known.",
    }),
  },
  $I.annote("DmsMirrorConnected", {
    description: "A reachable DMS mirror, optionally with its resolved root id.",
  })
) {}

export class DmsMirrorDisconnected extends S.Class<DmsMirrorDisconnected>($I`DmsMirrorDisconnected`)(
  {
    state: S.tag("disconnected"),
    reason: DmsMirrorDisconnectReason,
  },
  $I.annote("DmsMirrorDisconnected", {
    description: "An unreachable DMS mirror with its known disconnect reason.",
  })
) {}

export const DmsMirrorConnection = S.Union([DmsMirrorConnected, DmsMirrorDisconnected]).pipe(
  S.toTaggedUnion("state"),
  $I.annoteSchema("DmsMirrorConnection", {
    description: "Exhaustive connected or disconnected state of a DMS mirror.",
  })
)
export type DmsMirrorConnection = typeof DmsMirrorConnection.Type

export class DmsMirrorProbe extends S.Class<DmsMirrorProbe>($I`DmsMirrorProbe`)(
  {
    connection: DmsMirrorConnection,
    provider: DmsProvider.annotateKey({
      description: "DMS provider the probe describes.",
    }),
  },
  $I.annote("DmsMirrorProbe", {
    description: "Connectivity probe result for one DMS mirror adapter.",
  })
) {}
```

Construct cases with `DmsMirrorConnection.cases.connected.make({ rootRemoteId })` and `.cases.disconnected.make({ reason })`; omit `state` because `S.tag(...)` supplies it. Branch with `.guards` or `.match` rather than recreating `isConnected` predicates.

# Migration inventory

- `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:512-533` — retain `DmsMirrorDisconnectReason` as the reason payload domain.
- `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:535-584` — replace the prose, example, and four-field probe declaration with the two case classes, `DmsMirrorConnection`, and a probe containing `connection` plus `provider`.
- `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:593-602` — update the availability example to construct the disconnected case with reason `probe-failed`.
- `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:620-626` — update the service example to construct the connected case.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:757-760` — cache entry type remains `DmsMirrorProbe`; no structural read occurs here.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:736` — update the cache-success comment from the removed boolean spelling to the connected union case.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:768-771` — rewrite connected/disconnected prose in terms of the tagged union.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:792-804` — construct `connection` with the disconnected `probe-failed` case on failure and the connected case carrying `rootRemoteId` on success.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:815` — replace the boolean TTL ternary with `DmsMirrorConnection.match(probe.connection, ...)` or the schema-derived connected guard.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorFixture.ts:566-569` — construct the connected connection case with `DMS_MIRROR_FIXTURE_ROOT_ID`.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorFixture.ts:573-574` — update fixture-layer prose to name the connected case rather than implying a boolean field.
- `apps/professional-desktop/src/sync/DmsMirrorDisconnected.ts:14-21` — import `DmsMirrorConnection`; the standalone `effect/Option` import becomes unnecessary.
- `apps/professional-desktop/src/sync/DmsMirrorDisconnected.ts:76-82` — construct the disconnected connection case with `credentials-missing`.
- `apps/professional-desktop/src/runtime/Layer.ts:252-253` — update the runtime-layer comment from `connected: false` to the disconnected union case.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1307-1311` — replace `probe.rootRemoteId` with an exhaustive connection match: the connected case supplies its payload and the disconnected case supplies `O.none()` to `classifyRemoteEvent`.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1542-1554` — pass `probe.connection` into `VaultSyncStatus` instead of copying `connected` and `disconnectReason`; this is completed by the sibling design.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1651` — pass `DmsMirrorConnection.guards.connected(probe.connection)` to `recoverStalledOperations`, or refactor that helper to accept the union and match inside it.
- `packages/documents/use-cases/src/aggregates/Sync/server.ts:14` — the wildcard export already exposes the new union and cases to server consumers.
- `packages/documents/use-cases/src/public.ts:43` — export `DmsMirrorConnection` and its type/cases alongside `DmsMirrorDisconnectReason` because the wire-compatible vault status decoded side reuses it.

Whole-repository search found no other source construction or member read for `DmsMirrorProbe.connected`, `.disconnectReason`, or `.rootRemoteId` beyond the sites above.

# Guard-deletion accounting

- `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:548-551` — delete the comment-only invariant that explains how `connected` must cohere with reason presence; the tagged cases make it structural.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:795-804` — delete the paired boolean/Option/root writes whose object literals manually enforce mutual exclusion.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:815` — delete the `probe.connected` ternary; exhaustively match the connection case to select the cache TTL.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1310` — delete the ability to read `rootRemoteId` without proving the probe is connected; the connected case owns the payload.
- `apps/professional-desktop/src/sync/DmsMirrorDisconnected.ts:80` — delete the manual `false + Some(reason)` coherence write.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorFixture.ts:568` — delete the manual `true + omitted reason + Some(root)` coherence write.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1544-1545` — delete the parallel field copy into the sibling read model; pass the single upstream union through.

# Encoded-side impact

none (internal)

# Test impact

- `packages/documents/use-cases/test/Sync.test.ts:127-136` — construct the connected case and assert `DmsMirrorConnection.guards.connected(probe.connection)` rather than `.connected`.
- `packages/documents/server/test/DmsMirrorBox.test.ts:436-443` and `:474-480` — assert the connected guard and read `rootRemoteId` only inside the narrowed connected case.
- `packages/documents/server/test/DmsMirrorBox.test.ts:852-864` — assert the connected case, provider, and narrowed root payload.
- `packages/documents/server/test/DmsMirrorBox.test.ts:867-880` — assert the disconnected case and `reason === "probe-failed"`; the union eliminates the old disconnected `rootRemoteId` assertion.
- `packages/documents/server/test/VaultSyncEngine.test.ts:207` and `:518` touch the derived vault status rather than the probe directly; update them under the sibling design.
- Add a schema-derived round-trip for `DmsMirrorConnection` covering connected with/without a root and both disconnected reasons. `packages/documents/use-cases/test/Sync.test.ts:139-149` currently omits `DmsMirrorProbe` from its arbitrary round-trip list.

# Risk & sequencing

Land this Tier 1 shared-domain refactor immediately before, or atomically with, `vault-sync-status-connected`. The latter imports and reuses `DmsMirrorConnection`; landing it first is impossible. `DmsMirror.ts`, `VaultSyncEngine.service.ts`, `public.ts`, and shared tests overlap the sibling design, so one apply agent should coordinate both documents. Keep the tagged union internal encoding out of the RPC: the Tier 2 sibling owns the old top-level `connected`/`disconnectReason` compatibility transform.
