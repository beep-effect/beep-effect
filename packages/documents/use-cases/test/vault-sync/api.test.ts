import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import {
  VaultSyncApi,
  VaultSyncPass,
  VaultSyncRequests,
  VaultSyncRequestsLive,
  vaultSyncCli,
  vaultSyncRemoteCli,
} from "@beep/documents-use-cases/aggregates/VaultSync";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as TestClock from "effect/testing/TestClock";

it("derives a CLI without internal command targets", () => {
  const command = vaultSyncCli({ headers: {} });
  expect(command).toBeDefined();
  expect(A.map(VaultSyncApi.commands, (command) => command.tag)).toEqual([
    "RequestVaultSync",
    "ProbeDestination",
    "ClaimDestinationName",
    "RecordConflict",
    "PauseDestination",
    "ResumeDestination",
    "ReviewConflict",
  ]);
});

it("derives the remote CLI from the same Api over the sidecar endpoint", () => {
  const command = vaultSyncRemoteCli({ url: "http://127.0.0.1:3939/vault-sync/rpc", headers: {} });
  expect(command.name).toBe(vaultSyncCli({ headers: {} }).name);
});

class Initiators extends Domain.Model("VaultSyncInitiatorRouting", {
  aggregates: [V.SyncDestination],
  policies: [VaultSyncRequests],
  sagas: [VaultSyncPass],
}) {}

class Starts extends Context.Service<Starts, Ref.Ref<ReadonlyArray<string>>>()(
  "@beep/documents-use-cases/test/vault-sync/api.test/Starts"
) {}

const recordingPass = VaultSyncPass.toLayer<never, Starts, never>(
  Effect.gen(function* () {
    const starts = yield* Starts;
    return Effect.fn("test.pass")(function* ({
      key,
      probeOnly,
    }: {
      readonly key: string;
      readonly destinationId: V.DestinationId;
      readonly probeOnly?: boolean;
    }): Effect.fn.Return<{ readonly operationsSucceeded: number; readonly conflicts: number }> {
      yield* Ref.update(starts, A.append(`${probeOnly === true ? "probe" : "pass"}:${key}`));
      return { operationsSucceeded: 0, conflicts: 0 };
    });
  })
);

it.effect("routes each public request to one pass or probe run keyed by its request id", () =>
  Effect.gen(function* () {
    const starts = yield* Ref.make<ReadonlyArray<string>>([]);
    const context = yield* Layer.build(
      Initiators.layer(Layer.merge(VaultSyncRequestsLive, recordingPass)).pipe(
        Layer.provide(Layer.succeed(Starts, starts)),
        Layer.provide(Domain.InMemory)
      )
    );
    const destinations = Context.get(context, V.SyncDestination);
    const id = V.DestinationId.make("documents_sync_destination_avaultrouting");
    yield* destinations.send(id, V.RegisterDestination.make({ orgId: 1, workspaceId: 1, name: "vault" }));
    yield* destinations.send(id, V.RequestVaultSync.make({ requestId: "r1" }));
    yield* destinations.send(id, V.ProbeDestination.make({ requestId: "p1" }));
    const started = yield* Ref.get(starts).pipe(
      Effect.repeat({ until: (value) => value.length >= 2, schedule: Schedule.spaced("5 millis"), times: 400 })
    );
    expect(A.sort(started, Order.String)).toEqual([
      "pass:documents_sync_destination_avaultrouting/VaultSyncRequested/r1",
      "probe:documents_sync_destination_avaultrouting/DestinationProbeRequested/p1",
    ]);
  }).pipe(TestClock.withLive)
);
