import * as Domain from "@alchemy.run/domain";
import * as Cli from "@alchemy.run/domain/Cli";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import {
  authorizeVaultSyncDelivery,
  VaultSyncHttp,
  VaultSyncMcpLive,
  VaultSyncReadToolkit,
  VaultSyncSessionLive,
} from "@beep/documents-server/aggregates/Sync";
import { VaultSyncApi, VaultSyncModel, VaultSyncPolicies } from "@beep/documents-use-cases/aggregates/VaultSync";
import { connectHttp, layerConformanceHttp } from "@beep/mcp-kit/test/Conformance";
import * as BunChildProcessSpawner from "@effect/platform-bun/BunChildProcessSpawner";
import * as BunHttpPlatform from "@effect/platform-bun/BunHttpPlatform";
import * as BunTerminal from "@effect/platform-bun/BunTerminal";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Command from "effect/cli/Command";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Etag from "effect/http/Etag";
import * as Headers from "effect/http/Headers";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import type * as Aggregate from "@alchemy.run/domain/Aggregate";
import type * as Platform from "@alchemy.run/domain/Platform";

const ownKey = "documents_sync_destination_aown";
const foreignKey = "documents_sync_destination_aforeign";
// The foreign workspace partition keeps its plain spelling; destination keys are minted ids.
const foreignKeys: ReadonlyArray<string> = [foreignKey, "foreign"];

// The generated CLI requires these services even for a read command. No
// filesystem or child-process operation is exercised by this suite.
const cliPlatform = BunChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(FileSystem.layerNoop({}), Path.layer, Stdio.layerTest({}), BunTerminal.layer))
);

const request = S.decodeEffect(V.VaultSyncRequest)({
  principal: { kind: "User", userId: 1 },
  principalKey: "User:1",
  actorSourceKind: "User",
  sourceKind: "http",
  orgId: 1,
  workspaceId: 1,
  correlationId: "security-test",
  sessionRef: "verified-test-session",
});
const keyPayload = S.Struct({ key: S.Union([S.String, S.Struct({ id: S.String })]) });

const fixture = Effect.gen(function* () {
  const identity = yield* request;
  const active = yield* Ref.make(true);
  const resolver = V.SessionResolver.of({
    resolve: Effect.fn("VaultSyncSecurity.fixture")(() => Effect.succeed(identity)),
    grants: Effect.fn("VaultSyncSecurity.fixture")(() =>
      Ref.get(active).pipe(
        Effect.map((allowed) =>
          allowed ? [V.VaultSyncGrant.make({ orgId: 1, workspaceId: 1, diagnostic: false })] : []
        )
      )
    ),
    scope: Effect.fn("VaultSyncSecurity.fixture")((_rpc: string, payload: unknown) =>
      S.decodeUnknownEffect(keyPayload)(payload).pipe(
        Effect.mapBoth({
          onFailure: () => V.ScopeDenied.make({}),
          onSuccess: ({ key }) =>
            V.VaultSyncScope.make({
              orgId: A.contains(foreignKeys, S.is(S.String)(key) ? key : key.id) ? 2 : 1,
              workspaceId: 1,
            }),
        })
      )
    ),
    revoked: Effect.fn("VaultSyncSecurity.fixture")(() => Effect.never),
  });
  const host = VaultSyncModel.layer(VaultSyncPolicies).pipe(Layer.provide(Domain.InMemory));
  const session = VaultSyncSessionLive.pipe(Layer.provide(Layer.succeed(V.SessionResolver, resolver)));
  return { active, identity, resolver, host: Layer.merge(host, session) };
});

describe("Views as security boundaries", () => {
  it.effect("cross-tenant key guessing", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      const context = yield* Layer.build(f.host);
      const client = yield* VaultSyncApi.clientInProcess.pipe(Effect.provideContext(context));
      const result = yield* Effect.flip(client.VaultSyncStatus.get(V.DestinationId.make(foreignKey)));
      expect(result._tag).toBe("ScopeDenied");
      const own = yield* client.VaultSyncStatus.get(V.DestinationId.make(ownKey));
      expect(own).toBeNull();
    })
  );

  it.effect("stream history reads", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      const context = yield* Layer.build(f.host);
      const client = yield* VaultSyncApi.clientInProcess.pipe(Effect.provideContext(context));
      const seen = yield* Ref.make(0);
      const result = yield* client.OpenConflicts.events(V.DestinationId.make(foreignKey)).pipe(
        Stream.runForEach(() => Ref.update(seen, (n) => n + 1)),
        Effect.flip
      );
      expect(result._tag).toBe("ScopeDenied");
      const count = yield* Ref.get(seen);
      expect(count).toBe(0);
    })
  );

  it.effect("revoked membership after subscription drops buffered frames", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      const seen = yield* Ref.make<ReadonlyArray<number>>([]);
      const result = yield* authorizeVaultSyncDelivery(
        Stream.fromIterable([1, 2, 3]).pipe(Stream.buffer({ capacity: 3 })),
        "VaultSyncStatus.watch",
        ownKey,
        Headers.empty
      ).pipe(
        Stream.runForEach((frame) => Ref.update(seen, A.append(frame)).pipe(Effect.andThen(Ref.set(f.active, false)))),
        Effect.provideService(V.SessionResolver, f.resolver),
        Effect.flip
      );
      expect(result._tag).toBe("ScopeDenied");
      const frames = yield* Ref.get(seen);
      expect(frames).toEqual([1]);
    })
  );

  it.effect("same policy enforced identically over CLI, MCP and HTTP", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      for (const sourceKind of V.TransportKind.literals) {
        const identity = V.VaultSyncRequest.make({ ...f.identity, sourceKind });
        const resolver = V.SessionResolver.of({
          ...f.resolver,
          resolve: Effect.fn("VaultSyncSecurity.fixture")(() => Effect.succeed(identity)),
        });
        const session = VaultSyncSessionLive.pipe(Layer.provide(Layer.succeed(V.SessionResolver, resolver)));
        const context = yield* Layer.build(Layer.merge(f.host, session));
        const client = yield* VaultSyncApi.clientInProcess.pipe(Effect.provideContext(context));
        const diagnostics = yield* Effect.flip(client.OperationQueue.get(V.DestinationId.make(ownKey)));
        expect(diagnostics._tag).toBe("ScopeDenied");
        const foreign = yield* Effect.flip(client.DestinationList.get(V.WorkspaceKey.make("foreign")));
        expect(foreign._tag).toBe("ScopeDenied");
      }
    })
  );

  it.effect("HTTP rejects a guessed foreign key through the generated endpoint", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      const appLayer = HttpApiBuilder.layer(VaultSyncHttp.api, { openapiPath: "/openapi.json" }).pipe(
        Layer.provide(VaultSyncHttp.layer),
        Layer.provide(f.host),
        Layer.provide(Layer.succeed(V.SessionResolver, f.resolver)),
        Layer.provide(BunHttpPlatform.layer),
        Layer.provide(Etag.layer),
        Layer.provide(cliPlatform)
      );
      const app = yield* Effect.acquireRelease(
        Effect.sync(() => HttpRouter.toWebHandler(appLayer, { disableLogger: true })),
        (app) => Effect.promise(() => app.dispose())
      );
      const response = yield* Effect.promise(() =>
        app.handler(new Request(`http://test/VaultSyncStatus/${foreignKey}`))
      );
      expect(response.status).toBe(403);
      const body = yield* Effect.promise(() => response.json());
      expect(body).toEqual({ _tag: "ScopeDenied" });
    })
  );

  it.effect("CLI rejects a guessed foreign key through the generated command", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      const context = yield* Layer.build(Layer.merge(f.host, cliPlatform));
      const cli = Cli.toCli({
        apiName: VaultSyncApi.apiName,
        group: VaultSyncApi.group,
        serves: VaultSyncApi.serves,
        client: VaultSyncApi.clientInProcess,
      });
      const failure = yield* Command.runWith(cli, { version: "test", renderErrors: false })([
        "vault-sync-status",
        "get",
        "--key",
        foreignKey,
      ]).pipe(Effect.provideContext(context), Effect.flip);
      expect(failure._tag).toBe("CallRejected");
    })
  );

  it.effect("MCP rejects a guessed foreign key through its read tool handler", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      const harness = layerConformanceHttp({
        name: "vault-sync-security-test",
        version: "0.0.0",
        instructions: "Read only",
        registrations: VaultSyncMcpLive.pipe(Layer.provide(f.host)),
        tool: { name: "VaultSyncApi_VaultSyncStatus_get", arguments: { key: ownKey }, invalidArguments: {} },
      });
      const context = yield* Layer.build(harness);
      const { rpc } = yield* connectHttp().pipe(Effect.provideContext(context));
      const result = yield* rpc["tools/call"]({
        name: "VaultSyncApi_VaultSyncStatus_get",
        arguments: { key: foreignKey },
      });
      expect(result.isError).toBe(true);
    })
  );

  it.effect("revocation ends an idle subscription with a typed denial", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      const revoked = yield* Deferred.make<never, V.ScopeDenied>();
      const resolver = V.SessionResolver.of({
        ...f.resolver,
        revoked: Effect.fn("VaultSyncSecurity.revoked")(() => Deferred.await(revoked)),
      });
      yield* Deferred.fail(revoked, V.ScopeDenied.make({}));
      const denial = yield* authorizeVaultSyncDelivery(Stream.never, "VaultSyncStatus.watch", ownKey, {}).pipe(
        Stream.runDrain,
        Effect.provideService(V.SessionResolver, resolver),
        Effect.flip
      );
      expect(denial._tag).toBe("ScopeDenied");
    })
  );

  it.effect("Session persists provenance and bridges command correlation to SendMeta", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      const seen = yield* Ref.make<ReadonlyArray<Aggregate.SendMeta>>([]);
      const recording = Layer.effect(
        Domain.Platform,
        Effect.gen(function* () {
          const inner = yield* Domain.Platform;
          const wrap = (store: Platform.AggregateStore): Platform.AggregateStore => ({
            ...store,
            send: Effect.fn("VaultSyncSecurity.recordSend")((id, command, meta) =>
              store.send(id, command, meta).pipe(Effect.tap(() => Ref.update(seen, A.append(meta))))
            ),
          });
          return Domain.Platform.of({
            model: Effect.fn("VaultSyncSecurity.recordModel")((model) =>
              inner.model(model).pipe(
                Effect.map((host) => ({
                  ...host,
                  aggregate: Effect.fn("VaultSyncSecurity.recordAggregate")((aggregate, kit) =>
                    host.aggregate(aggregate, kit).pipe(Effect.map(wrap))
                  ),
                }))
              )
            ),
          });
        })
      ).pipe(Layer.provide(Domain.InMemory));
      const resolver = V.SessionResolver.of({
        ...f.resolver,
        scope: Effect.fn("VaultSyncSecurity.commandScope")(() =>
          Effect.succeed(V.VaultSyncScope.make({ orgId: 1, workspaceId: 1 }))
        ),
      });
      const session = VaultSyncSessionLive.pipe(Layer.provide(Layer.succeed(V.SessionResolver, resolver)));
      const hosted = VaultSyncModel.layer(VaultSyncPolicies).pipe(Layer.provide(recording));
      const context = yield* Layer.build(Layer.merge(session, hosted));
      const client = yield* VaultSyncApi.clientInProcess.pipe(Effect.provideContext(context));
      yield* client.ClaimDestinationName(V.reservationKey({ orgId: 1, name: "test" }), {
        claim: V.NameClaim.make({
          orgId: 1,
          workspaceId: 1,
          destinationId: V.DestinationId.make(ownKey),
          name: "test",
          previousName: null,
        }),
      });
      const records = yield* Ref.get(seen);
      expect(records).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            correlationId: "security-test",
            context: {
              "documents/vault-sync/RequestContext/v1": expect.objectContaining({
                principal: { kind: "User", userId: 1 },
                principalKey: "User:1",
                sourceKind: "http",
                actorSourceKind: "User",
                orgId: 1,
                workspaceId: 1,
                correlationId: "security-test",
                sessionRef: "verified-test-session",
              }),
            },
          }),
        ])
      );
    })
  );

  it("MCP contains exactly twelve closed read tools", () => {
    const names = R.keys(VaultSyncReadToolkit.tools);
    expect(names).toHaveLength(12);
  });
});
