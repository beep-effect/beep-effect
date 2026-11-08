import { AlchemyPostgres, AlchemyPostgresConfig, ProvenanceMapping } from "@beep/alchemy-postgres";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { VaultSyncSessionLive } from "@beep/documents-server/aggregates/Sync";
import { VaultSyncApi, VaultSyncModel, VaultSyncPolicies } from "@beep/documents-use-cases/aggregates/VaultSync";
import { PgliteTestLayer } from "@beep/pglite/Pglite.test-layer";
import { describe, expect, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

const identity = V.VaultSyncRequest.make({
  principal: { kind: "User", userId: 5 },
  principalKey: "User:5",
  sourceKind: "http",
  actorSourceKind: "User",
  orgId: 1,
  workspaceId: 1,
  correlationId: "provenance-test",
  sessionRef: "verified-provenance-session",
});
const resolver = V.SessionResolver.of({
  resolve: Effect.fn("VaultSyncProvenance.resolve")(() => Effect.succeed(identity)),
  grants: Effect.fn("VaultSyncProvenance.grants")(() =>
    Effect.succeed([V.VaultSyncGrant.make({ orgId: 1, workspaceId: 1, diagnostic: false })])
  ),
  scope: Effect.fn("VaultSyncProvenance.scope")(() =>
    Effect.succeed(V.VaultSyncScope.make({ orgId: 1, workspaceId: 1 }))
  ),
  revoked: Effect.fn("VaultSyncProvenance.revoked")(() => Effect.never),
});
// The mappings the production host mounts (Layer.ts): genesis first, then the v1 request context,
// whose principalKey is the string field the driver copies.
const config = AlchemyPostgresConfig.make({
  provenance: O.some(
    ProvenanceMapping.make({
      contextKey: V.GenesisProvenance.key,
      principalField: "principal",
      sourceKindField: "source",
    })
  ),
  provenanceMappings: [
    ProvenanceMapping.make({
      contextKey: V.VaultSyncRequestContext.key,
      principalField: "principalKey",
      sourceKindField: "sourceKind",
    }),
  ],
});
const Rows = S.Array(S.Struct({ principal: S.NullOr(S.String), source_kind: S.NullOr(S.String) }));
const DerivedRows = S.Array(
  S.Struct({
    tag: S.String,
    principal: S.NullOr(S.String),
    source_kind: S.NullOr(S.String),
    correlation_id: S.NullOr(S.String),
    root_principal: S.NullOr(S.String),
    root_source_kind: S.NullOr(S.String),
  })
);
const destinationId = V.DestinationId.make("documents_sync_destination_aprovenance");

describe("vault-sync driver provenance", () => {
  layer(PgliteTestLayer, { timeout: "30 seconds", excludeTestServices: true })("audit rows", (it) => {
    it.effect("fills the driver principal and source-kind columns from the v1 request context (D17 F8)", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const hosted = VaultSyncModel.layer(VaultSyncPolicies).pipe(Layer.provide(AlchemyPostgres.layer(config)));
        const session = VaultSyncSessionLive.pipe(Layer.provide(Layer.succeed(V.SessionResolver, resolver)));
        const context = yield* Layer.build(Layer.merge(session, hosted));
        const client = yield* VaultSyncApi.clientInProcess.pipe(Effect.provideContext(context));
        const key = V.reservationKey({ orgId: 1, name: "provenance" });
        yield* client.ClaimDestinationName(key, {
          claim: V.NameClaim.make({
            orgId: 1,
            workspaceId: 1,
            destinationId,
            name: "provenance",
            previousName: null,
          }),
        });
        const rows = yield* sql`SELECT principal, source_kind FROM alchemy_aggregate_event
          WHERE aggregate = 'DestinationNameReservation' AND id = ${key}`.pipe(
          Effect.flatMap(S.decodeUnknownEffect(Rows))
        );
        expect(rows).toEqual([{ principal: "User:5", source_kind: "http" }]);

        // The DestinationNames policy registers the destination: a derived event in another aggregate.
        // Its row joins on the kernel correlation id the Session seeded back to the caller's event.
        const derived = yield* sql`SELECT derived.tag, derived.principal, derived.source_kind, derived.correlation_id,
            root.principal AS root_principal, root.source_kind AS root_source_kind
          FROM alchemy_aggregate_event derived
          LEFT JOIN alchemy_aggregate_event root
            ON root.correlation_id = derived.correlation_id AND root.principal IS NOT NULL
          WHERE derived.aggregate = 'SyncDestination' AND derived.id = ${destinationId}`.pipe(
          Effect.flatMap(S.decodeUnknownEffect(DerivedRows)),
          Effect.repeat({ until: A.isReadonlyArrayNonEmpty, schedule: Schedule.spaced("20 millis") }),
          Effect.timeout("10 seconds")
        );
        // The policy's send captures the reaction fiber's context, not the caller's: no principal is
        // stamped on the derived row, and the join recovers the caller's principal and transport.
        expect(derived).toEqual([
          {
            tag: "DestinationRegistered",
            principal: null,
            source_kind: null,
            correlation_id: "provenance-test",
            root_principal: "User:5",
            root_source_kind: "http",
          },
        ]);
      })
    );
  });
});
