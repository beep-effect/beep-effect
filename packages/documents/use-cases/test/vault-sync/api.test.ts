import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import {
  VaultSyncApi,
  VaultSyncDestinationIdAttribute,
  VaultSyncModel,
  VaultSyncPass,
  VaultSyncPolicies,
  VaultSyncRequests,
  VaultSyncRequestsLive,
  vaultSyncCli,
  vaultSyncRemoteCli,
} from "@beep/documents-use-cases/aggregates/VaultSync";
import { expect, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import { identity as passthrough } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Tracer from "effect/Tracer";
import * as TestClock from "effect/testing/TestClock";

it("derives a CLI without internal command targets", () => {
  const command = vaultSyncCli({ headers: {} });
  expect(A.flatMap(command.subcommands, (group) => A.map(group.commands, (child) => child.name))).toEqual([
    "request-vault-sync",
    "probe-destination",
    "claim-destination-name",
    "record-conflict",
    "pause-destination",
    "resume-destination",
    "review-conflict",
    "vault-sync-status",
    "open-conflicts",
    "destination-list",
    "operation-queue",
  ]);
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

const recordingPass = VaultSyncPass.toLayer(
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

const spans: Array<Tracer.NativeSpan> = [];
const tracer = Tracer.make({
  span: (options) => {
    const span = new Tracer.NativeSpan(options);
    spans.push(span);
    return span;
  },
});

it.effect("records the destination on each VaultSyncRequests.start span (D17)", () =>
  Effect.gen(function* () {
    const starts = yield* Ref.make<ReadonlyArray<string>>([]);
    const context = yield* Layer.build(
      Initiators.layer(Layer.merge(VaultSyncRequestsLive, recordingPass)).pipe(
        Layer.provide(Layer.succeed(Starts, starts)),
        Layer.provide(Domain.InMemory)
      )
    );
    const destinations = Context.get(context, V.SyncDestination);
    const id = V.DestinationId.make("documents_sync_destination_atracedrouting");
    yield* destinations.send(id, V.RegisterDestination.make({ orgId: 1, workspaceId: 1, name: "vault" }));
    yield* destinations.send(id, V.RequestVaultSync.make({ requestId: "t1" }));
    yield* Ref.get(starts).pipe(
      Effect.repeat({ until: A.isReadonlyArrayNonEmpty, schedule: Schedule.spaced("5 millis"), times: 400 })
    );
    const started = A.filter(spans, (span) => span.name === "VaultSyncRequests.start");
    expect(A.map(started, (span) => span.attributes.get(VaultSyncDestinationIdAttribute))).toEqual([id]);
  }).pipe(Effect.withTracer(tracer), TestClock.withLive)
);

it.effect("public read validators authorize enrolled requests and reject missing identities", () =>
  Effect.gen(function* () {
    const context = yield* Layer.build(
      VaultSyncModel.layer(VaultSyncPolicies).pipe(
        Layer.provide(Domain.InMemory),
        Layer.provide(SecureRandom.layerWebCrypto)
      )
    );
    const identity = yield* S.decodeEffect(V.VaultSyncRequest)({
      principal: { kind: "User", userId: 1 },
      principalKey: "User:1",
      actorSourceKind: "User",
      sourceKind: "http",
      orgId: 1,
      workspaceId: 1,
      correlationId: "read-access-test",
      sessionRef: "verified",
    });
    const resolver = V.SessionResolver.of({
      resolve: Effect.fn("ReadAccessTest.resolve")(() => Effect.succeed(identity)),
      scope: Effect.fn("ReadAccessTest.scope")(() =>
        Effect.succeed(V.VaultSyncScope.make({ orgId: 1, workspaceId: 1 }))
      ),
      grants: Effect.fn("ReadAccessTest.grants")(() =>
        Effect.succeed([V.VaultSyncGrant.make({ orgId: 1, workspaceId: 1, diagnostic: true })])
      ),
      revoked: Effect.fn("ReadAccessTest.revoked")(() => Effect.never),
    });
    const authenticated = yield* VaultSyncApi.clientInProcess.pipe(
      Effect.provideContext(context),
      Effect.provideService(
        V.Session,
        V.Session.of((effect) =>
          effect.pipe(
            Effect.provideService(V.VaultSyncRequestContext, identity),
            Effect.provideService(V.SessionResolver, resolver)
          )
        )
      )
    );
    const anonymous = yield* VaultSyncApi.clientInProcess.pipe(
      Effect.provideContext(context),
      Effect.provideService(V.Session, V.Session.of(passthrough))
    );
    const key = V.DestinationId.make("documents_sync_destination_areadaccess");
    for (const read of [
      authenticated.DestinationList.get(V.WorkspaceKey.make("1:1")).pipe(Effect.asVoid),
      authenticated.OpenConflicts.get(key).pipe(Effect.asVoid),
      authenticated.OperationQueue.get(key).pipe(Effect.asVoid),
      authenticated.VaultSyncStatus.get(key).pipe(Effect.asVoid),
    ]) {
      const allowed = yield* read.pipe(Effect.result);
      assertSuccess(allowed, undefined);
    }
    for (const read of [
      anonymous.DestinationList.get(V.WorkspaceKey.make("1:1")).pipe(Effect.asVoid),
      anonymous.OpenConflicts.get(key).pipe(Effect.asVoid),
      anonymous.OperationQueue.get(key).pipe(Effect.asVoid),
      anonymous.VaultSyncStatus.get(key).pipe(Effect.asVoid),
    ]) {
      const denied = yield* read.pipe(Effect.result);
      assertFailure(denied, V.ScopeDenied.make({}));
    }
  })
);
