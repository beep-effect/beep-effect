import { AlchemyPostgres, AlchemyPostgresConfig, ProvenanceMapping } from "@beep/alchemy-postgres";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { VaultSyncSessionLive } from "@beep/documents-server/aggregates/Sync";
import { VaultSyncApi, VaultSyncModel, VaultSyncPolicies } from "@beep/documents-use-cases/aggregates/VaultSync";
import { PgliteTestLayer } from "@beep/pglite/Pglite.test-layer";
import { describe, expect, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
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
// The mapping the cutover host mounts: principalKey is the string field the driver copies.
const config = AlchemyPostgresConfig.make({
  provenance: O.some(
    ProvenanceMapping.make({
      contextKey: "documents/vault-sync/RequestContext/v1",
      principalField: "principalKey",
      sourceKindField: "sourceKind",
    })
  ),
});
const Rows = S.Array(S.Struct({ principal: S.NullOr(S.String), source_kind: S.NullOr(S.String) }));

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
            destinationId: V.DestinationId.make("documents_sync_destination_aprovenance"),
            name: "provenance",
            previousName: null,
          }),
        });
        const rows = yield* sql`SELECT principal, source_kind FROM alchemy_aggregate_event
          WHERE aggregate = 'DestinationNameReservation' AND id = ${key}`.pipe(
          Effect.flatMap(S.decodeUnknownEffect(Rows))
        );
        expect(rows).toEqual([{ principal: "User:5", source_kind: "http" }]);
      })
    );
  });
});
