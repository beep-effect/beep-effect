import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { expect, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

class Initiators extends Domain.Model("VaultSyncInitiators", { aggregates: [V.SyncDestination] }) {}
const hosted = Initiators.layer(Layer.empty).pipe(Layer.provide(Domain.InMemory));
const destination = V.DestinationId.make("vault-initiators");

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
      const state = yield* destinations.state(destination);
      expect(state._tag === "Registered" && state.paused).toBe(true);
    })
  );
});
