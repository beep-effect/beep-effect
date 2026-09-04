# Instance

- id: `dms-mirror-probe-connected`
- file:line: `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:568`
- symbol: `DmsMirrorProbe`
- members: `connected`, `disconnectReason`
- evidence classes:
  - E3 — `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:548`: the JSDoc states that `disconnectReason` is none while connected and carries a reason while disconnected.
  - E1 — `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:796`: failure writes `connected: false` with `probe-failed`; success at line 803 writes `connected: true` with no reason. The app disconnected layer writes the credentials-missing case.

# Current shape

Live declaration at `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:581`:

```ts
export class DmsMirrorProbe extends S.Class<DmsMirrorProbe>($I`DmsMirrorProbe`)(
  {
    connected: S.Boolean.annotateKey({
      description: "Whether the mirror adapter can reach the provider.",
    }),
    disconnectReason: S.Option(DmsMirrorDisconnectReason).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Why the provider is disconnected; none while the probe reports connected.",
    }),
    probedAt: S.Option(S.DateTimeUtc).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "When the adapter last actually asked the provider; none when no probe has contacted it.",
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

The boolean plus optional reason represent twelve combinations before considering
`rootRemoteId`: two boolean values times `None` or one of five disconnect
reasons. Six connectivity states are legal:

- connected, with an optional resolved `rootRemoteId`.
- disconnected with exactly one of the five values in
  `DmsMirrorDisconnectReason`, with no root id.

`connected` with a reason is illegal. A disconnected probe with no reason is not produced inside this internal port, and a disconnected probe cannot honestly carry a resolved root id. The older reasonless wire case belongs only to `VaultSyncStatus` decoding and is normalized at that boundary.
`probedAt` is orthogonal observation metadata shared by both connection cases;
it remains an `Option` on the enclosing probe rather than being duplicated in
each tagged member.

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
    probedAt: S.Option(S.DateTimeUtc).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "When the adapter last actually asked the provider; none when no probe has contacted it.",
    }),
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

Refreshed against current `main` on 2026-09-03. The newer `probedAt` metadata
and `DmsMirrorAvailability.refresh` effect remain intact; only the correlated
connectivity fields collapse into `connection`.

- `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:488-526` — retain all five current `DmsMirrorDisconnectReason` values as the reason payload domain.
- `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:528-602` — replace the prose, example, and five-field probe declaration with the two case classes, `DmsMirrorConnection`, and a probe containing `connection`, `probedAt`, and `provider`.
- `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:615-635` — update the availability example to construct the disconnected case with reason `probe-failed`, while preserving both `probe` and `refresh`.
- `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:637-665` — update the service example to construct the connected case, again preserving both effects.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:757-760` — cache entry type remains `DmsMirrorProbe`; no structural read occurs here.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:762` — update the cache-success comment from the removed boolean spelling to the connected union case.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:808-815` — rewrite the live connected/disconnected probe prose in terms of the tagged union.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:849-868` — construct `connection` with the disconnected case on failure and the connected case carrying `rootRemoteId` on success; preserve `probedAt` on the enclosing probe in both paths.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:874` — replace the boolean TTL ternary with `DmsMirrorConnection.match(probe.connection, ...)` or the schema-derived connected guard.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorFixture.ts:567` — construct the connected connection case with `DMS_MIRROR_FIXTURE_ROOT_ID`; its defaulted `probedAt` remains `None`.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorFixture.ts:573-574` — update fixture-layer prose to name the connected case rather than implying a boolean field.
- `apps/professional-desktop/src/sync/DmsMirrorDisconnected.ts:14-21` — import `DmsMirrorConnection`; the standalone `effect/Option` import becomes unnecessary.
- `apps/professional-desktop/src/sync/DmsMirrorDisconnected.ts:61-62` — construct the disconnected connection case with `credentials-missing`; keep the same effect for both availability members.
- `apps/professional-desktop/src/runtime/Layer.ts:300` — update the runtime-layer comment from `connected: false` to the disconnected union case; lines 252-253 document Box CCG auth and are unrelated.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1279-1310` — replace `probe.rootRemoteId` with an exhaustive connection match: the connected case supplies its payload and the disconnected case supplies `O.none()` to `classifyRemoteEvent`.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1548-1562` — preserve force-refresh and `probedAt`; temporarily project `probe.connection` back to the existing `VaultSyncStatus.make` `connected`/`disconnectReason` fields. The later Tier 2 Vault singleton deletes this projection when it installs the compatibility codec.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1655-1662` — pass `DmsMirrorConnection.guards.connected(probe.connection)` to `recoverStalledOperations`, or refactor that helper to accept the union and match inside it.
- `packages/documents/use-cases/src/aggregates/Sync/server.ts:14` — the wildcard export already exposes the new union and cases to server consumers.
- `packages/documents/use-cases/src/public.ts:43` — export `DmsMirrorConnection` and its type/cases alongside `DmsMirrorDisconnectReason` because the wire-compatible vault status decoded side reuses it.

Whole-repository search found no other source construction or member read for `DmsMirrorProbe.connected`, `.disconnectReason`, or `.rootRemoteId` beyond the sites above.

# Guard-deletion accounting

- `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:548-551` — delete the comment-only invariant that explains how `connected` must cohere with reason presence; the tagged cases make it structural.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:849-868` — delete the paired boolean/Option/root writes whose object literals manually enforce mutual exclusion.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:874` — delete the `probe.connected` ternary; exhaustively match the connection case to select the cache TTL.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1310` — delete the ability to read `rootRemoteId` without proving the probe is connected; the connected case owns the payload.
- `apps/professional-desktop/src/sync/DmsMirrorDisconnected.ts:62` — delete the manual `false + Some(reason)` coherence write.
- `packages/documents/server/src/aggregates/Sync/DmsMirrorFixture.ts:567` — delete the manual `true + omitted reason + Some(root)` coherence write.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1554-1555` — centralize the temporary old-wire projection in one exhaustive union match; its deletion is accounted for by the later Vault design.

# Encoded-side impact

none (internal)

# Test impact

- `packages/documents/use-cases/test/Sync.test.ts:127-136` — construct the connected case and assert `DmsMirrorConnection.guards.connected(probe.connection)` rather than `.connected`.
- `packages/documents/server/test/DmsMirrorBox.test.ts:438-442` and `:476-480` — assert the connected guard and read `rootRemoteId` only inside the narrowed connected case.
- `packages/documents/server/test/DmsMirrorBox.test.ts:861-867` — assert the connected case, provider, narrowed root payload, and preserved `probedAt`.
- `packages/documents/server/test/DmsMirrorBox.test.ts:879-887` and `:945-950` — assert the disconnected case and reason, preserve `probedAt`, and remove the old disconnected `rootRemoteId` assertion.
- `packages/documents/server/test/DmsMirrorBox.test.ts:909-925` and `:948-950` — migrate every status-code and malformed-root assertion from `.connected`/`.disconnectReason` to the narrowed disconnected case and its owned reason; keep the root payload inaccessible on that case.
- `packages/documents/server/test/DmsMirrorBox.test.ts:970-973` — keep the cached `probe` versus explicit `refresh` behavior unchanged.
- `packages/documents/server/test/DmsMirrorBox.test.ts:977-983` — migrate the cached-failure and refreshed-reason readers to the disconnected case while preserving the refresh-call and `probedAt` assertions.
- `packages/documents/server/test/VaultSyncEngine.test.ts:207` and `:518` touch the derived vault status rather than the probe directly; update them under the sibling design.
- Add a schema-derived round-trip for `DmsMirrorConnection` covering connected with/without a root and all five disconnected reasons. `packages/documents/use-cases/test/Sync.test.ts` currently omits `DmsMirrorProbe` from its arbitrary round-trip list; include both `Some` and `None` `probedAt` metadata.

# Risk & sequencing

Land this Tier 1 shared-domain refactor first as its own PR. The Vault status
RPC remains on its current decoded and encoded fields in that PR; one
exhaustive projection temporarily maps the new internal union to those fields.
After Benjamin merges it, the Tier 2 Vault singleton reuses
`DmsMirrorConnection`, installs the old-keys compatibility codec, and deletes
the projection. Keep the tagged union's native encoding out of the RPC in both
steps.
