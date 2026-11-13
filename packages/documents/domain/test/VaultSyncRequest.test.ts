import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { Principal } from "@beep/shared-domain/entity/Principal";
import { expect, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Str from "effect/String";

class Initiators extends Domain.Model("VaultSyncInitiators", { aggregates: [V.SyncDestination] }) {}
const hosted = Initiators.layer(Layer.empty).pipe(Layer.provide(Domain.InMemory));
const destination = V.DestinationId.make("documents_sync_destination_avaultinitiators");

layer(hosted, { excludeTestServices: true, timeout: "20 seconds" })("public pass and probe initiators", (it) => {
  it.effect("refuse an unregistered destination, record requests, and refuse a pass while paused", () =>
    Effect.gen(function* () {
      const destinations = yield* V.SyncDestination;
      const early = yield* Effect.flip(destinations.send(destination, V.RequestVaultSync.make({ requestId: "r0" })));
      expect(early.rule).toBe("not-registered");
      const earlyProbe = yield* Effect.flip(
        destinations.send(destination, V.ProbeDestination.make({ requestId: "p0" }))
      );
      expect(earlyProbe.rule).toBe("not-registered");
      yield* destinations.send(destination, V.RegisterDestination.make({ orgId: 1, workspaceId: 1, name: "vault" }));
      const pass = yield* destinations.send(destination, V.RequestVaultSync.make({ requestId: "r1" }));
      expect(pass.version).toBeGreaterThan(1);
      yield* destinations.send(destination, V.ProbeDestination.make({ requestId: "p1" }));
      yield* destinations.send(destination, V.PauseDestination.make({}));
      const paused = yield* Effect.flip(destinations.send(destination, V.RequestVaultSync.make({ requestId: "r2" })));
      expect(paused.rule).toBe("destination-paused");
      const probe = yield* destinations.send(destination, V.ProbeDestination.make({ requestId: "p2" }));
      expect(probe.version).toBeGreaterThan(pass.version);
      const state = yield* destinations.get(destination);
      expect(state._tag === "Registered" && state.paused).toBe(true);
    })
  );
});

layer(hosted, { excludeTestServices: true, timeout: "20 seconds" })("request identity tokens", (it) => {
  it.effect("accept only bounded opaque request ids and principal keys (D17 F5, F8)", () =>
    Effect.gen(function* () {
      const decode = S.decodeUnknownExit(V.RequestVaultSync);
      expect(decode({ _tag: "RequestVaultSync", requestId: "pass_01-a" })._tag).toBe("Success");
      for (const requestId of ["", "clients/acme.docx", "has space", Str.repeat(65)("x")]) {
        expect(decode({ _tag: "RequestVaultSync", requestId })._tag).toBe("Failure");
      }
      expect(S.is(V.RequestToken)(Str.repeat(64)("x"))).toBe(true);
      const decodePrincipal = S.decodeEffect(Principal);
      const keys = yield* Effect.forEach(
        [
          { kind: "User", userId: 3 },
          { kind: "ServiceAccount", serviceAccountId: 4 },
          { kind: "Agent", agentId: 8, agentVersionId: 5, onBehalfOfUserId: 3 },
          { kind: "ConnectorAccount", connectorAccountId: 6 },
          { kind: "System", component: "Runtime" },
        ] as const,
        (encoded) => Effect.map(decodePrincipal(encoded), V.principalKeyOf)
      );
      expect(keys).toEqual(["User:3", "ServiceAccount:4", "Agent:5", "ConnectorAccount:6", "System:Runtime"]);
      expect(A.every(keys, S.is(V.PrincipalKey))).toBe(true);
      expect(S.is(V.PrincipalKey)("User:3")).toBe(true);
      expect(S.is(V.PrincipalKey)("User:acme matter")).toBe(false);
    })
  );
});
