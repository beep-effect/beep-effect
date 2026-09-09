# Instance

- id: `dms-mirror-probe-connected`
- file:line: `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:568`
- symbol: `DmsMirrorProbe`
- members: `connected`, `disconnectReason`, `rootRemoteId`
- evidence classes:
  - E3 — `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:558-561`: the port contract states that `disconnectReason` is none while connected and carries a reason for the honest disconnected states; the field's `None` constructor default used by connected writers is declared at line 586.
  - E1 — `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:849-867`: the Box failure branch writes `false`, `Some(reason)`, and no root together, while its success branch writes `true`, the defaulted absent reason, and `Some(rootRemoteId)` together. The no-credentials adapter writes disconnected plus reason with a defaulted absent root at `apps/professional-desktop/src/sync/DmsMirrorDisconnected.ts:61-62`; the connected-without-root case is explicitly constructed at `packages/documents/use-cases/test/Sync.test.ts:129` and documented at `DmsMirror.ts:568-576`.

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

The full connection cluster is one boolean plus reason/root presence, so it
represents eight coarse combinations. Exactly three are legal for this
internal port:

- connected without a reason and without a resolved root;
- connected without a reason and with a resolved root;
- disconnected with a reason and without a root.

Connected with a reason, disconnected without a reason, and disconnected with
a resolved root are never produced. Expanding the reason-present branch across
the five `DmsMirrorDisconnectReason` values yields seven specific connection
states: two connected root-presence states and five reasoned disconnected
variants.

The Box adapter, app-side no-credentials adapter, examples, fixtures, and tests
all preserve those implications. The reasonless compatibility state belongs
only to the separate Vault wire read model. Connected does not imply a root:
the documented constructor and use-cases test deliberately omit it. Root
presence does imply connected across every supported writer and the port
contract: root ids identify an actually resolved mirror root, while both
disconnected writers omit the field and Box explicitly writes `None` on
failure.
`probedAt` is orthogonal observation metadata shared by both connection cases;
it remains an `Option` on the enclosing probe rather than being duplicated in
each tagged member.

# Target schema

Define the internal probe connection union in `DmsMirror.ts`. The sibling
`vault-sync-status-connected` design consumes it at the server writer but uses
a separate root-free, reason-optional read-model union because the two
boundaries have different legitimate states. Both reuse the existing
`DmsMirrorDisconnectReason` `LiteralKit`; do not mint a duplicate reason
domain.

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

Refreshed against checkout SHA `7440cb8c4302ce64b87860069a464bafbf65f576` and frozen upstream corpus `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1` on 2026-09-08. The `probedAt` metadata
and `DmsMirrorAvailability.refresh` effect remain intact; only the correlated
connectivity fields collapse into `connection`.

- `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:488-526` — retain all five current `DmsMirrorDisconnectReason` values as the reason payload domain.
- `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:528-602` — replace the prose, example, and five-field probe declaration with the two case classes, `DmsMirrorConnection`, and a probe containing `connection`, `probedAt`, and `provider`. The disconnected case requires its reason; only the connected constructor replaces the old field's `None` default.
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
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1548-1562` — preserve force-refresh and `probedAt`; temporarily project `probe.connection` back to the existing `VaultSyncStatus.make` fields, mapping connected to `true`/`None` and disconnected to `false`/`Some(reason)`. The later Tier 2 Vault singleton deletes this projection when it installs the compatibility codec.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1655-1662` — pass `DmsMirrorConnection.guards.connected(probe.connection)` to `recoverStalledOperations`, or refactor that helper to accept the union and match inside it.
- `packages/documents/use-cases/src/aggregates/Sync/server.ts:14` — the wildcard export already exposes the new union and cases to server consumers.
- `packages/documents/use-cases/src/public.ts:43` — keep the existing client-safe `DmsMirrorDisconnectReason` export. The full probe connection remains on the server-only barrel because its connected case owns `rootRemoteId` and its disconnected case requires a reason; the Vault read model defines its own root-free, reason-optional public projection.

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
- `packages/documents/server/test/DmsMirrorBox.test.ts:879-887` and `:945-950` — assert the disconnected case and its reason literal, preserve `probedAt`, and remove the old disconnected `rootRemoteId` assertion.
- `packages/documents/server/test/DmsMirrorBox.test.ts:909-925` and `:948-950` — migrate every status-code and malformed-root assertion from `.connected`/`.disconnectReason` to the narrowed disconnected case and its owned reason literal; keep the root payload inaccessible on that case.
- `packages/documents/server/test/DmsMirrorBox.test.ts:970-973` — keep the cached `probe` versus explicit `refresh` behavior unchanged.
- `packages/documents/server/test/DmsMirrorBox.test.ts:977-983` — migrate the cached-failure and refreshed-reason readers to the disconnected case while preserving the refresh-call and `probedAt` assertions.
- `packages/documents/server/test/VaultSyncEngine.test.ts:207` and `:518` touch the derived vault status rather than the probe directly; update them under the sibling design.
- Add a schema-derived round-trip for `DmsMirrorConnection` covering connected with/without a root and all five disconnected reason variants. `packages/documents/use-cases/test/Sync.test.ts` currently omits `DmsMirrorProbe` from its arbitrary round-trip list; include both `Some` and `None` `probedAt` metadata.

# Risk & sequencing

Land this Tier 1 shared-domain refactor first as its own PR. The Vault status
RPC remains on its current decoded and encoded fields in that PR; one
exhaustive projection temporarily maps the new internal union to those fields.
After Benjamin merges it, the Tier 2 Vault singleton reuses
the DMS reason literal domain, exhaustively converts the probe union into its
own root-free and reason-optional connection read model, installs the old-keys
compatibility codec, and deletes the old-field projection. Keep both tagged
unions' native encodings out of the RPC in both steps.
