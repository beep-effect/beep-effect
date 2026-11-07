import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import {
  layerVaultSyncLaunchTokenResolver,
  layerVaultSyncTransportSession,
  VAULT_SYNC_RPC_PATH,
  VaultSyncHttp,
  VaultSyncLocalOperatorLive,
  VaultSyncMcpLive,
  VaultSyncMembershipLive,
  VaultSyncRevocationPause,
  VaultSyncRpcHttp,
  VaultSyncSessionBinding,
  VaultSyncSessionLive,
} from "@beep/documents-server/aggregates/Sync";
import {
  VaultSyncApi,
  VaultSyncModel,
  VaultSyncPass,
  VaultSyncPassModel,
  VaultSyncPolicies,
  VaultSyncRequests,
  VaultSyncRequestsLive,
  vaultSyncRemoteCli,
} from "@beep/documents-use-cases/aggregates/VaultSync";
import { ConformanceHttp, connectHttp, layerConformanceHttp } from "@beep/mcp-kit/test/Conformance";
import { PgliteTestLayer } from "@beep/pglite/Pglite.test-layer";
import * as BunChildProcessSpawner from "@effect/platform-bun/BunChildProcessSpawner";
import * as BunHttpPlatform from "@effect/platform-bun/BunHttpPlatform";
import * as BunTerminal from "@effect/platform-bun/BunTerminal";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Etag from "effect/http/Etag";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Headers from "effect/http/Headers";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";

const TOKEN = "launch-token-for-tests";
const bearer = { authorization: `Bearer ${TOKEN}` };
const own = V.DestinationId.make("documents_sync_destination_aown");
const foreign = V.DestinationId.make("documents_sync_destination_aforeign");

const cliPlatform = BunChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(FileSystem.layerNoop({}), Path.layer, Stdio.layerTest({}), BunTerminal.layer))
);

// A model with the public initiators' durable routing and a pass that only records its starts.
class InitiatorModel extends Domain.Model("VaultSync", {
  aggregates: VaultSyncPassModel.aggregates,
  views: VaultSyncPassModel.views,
  policies: [VaultSyncRequests],
  sagas: [VaultSyncPass],
}) {}

class PassStarts extends Context.Service<PassStarts, Ref.Ref<ReadonlyArray<string>>>()(
  "@beep/documents-server/test/VaultSyncApi.transport.test/PassStarts"
) {}

const recordingPass = VaultSyncPass.toLayer<never, PassStarts, never>(
  Effect.gen(function* () {
    const starts = yield* PassStarts;
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

const binding = Layer.effect(
  VaultSyncSessionBinding,
  Effect.map(
    S.decodeEffect(V.VaultSyncRequest)({
      principal: { kind: "User", userId: 7 },
      principalKey: "User:7",
      actorSourceKind: "User",
      sourceKind: "sidecar",
      orgId: 1,
      workspaceId: 1,
      correlationId: "bound",
      sessionRef: "desktop-launch",
    }),
    (request) => VaultSyncSessionBinding.of({ request, token: Redacted.make(TOKEN) })
  )
);

const schema = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`CREATE TABLE workspace_workspace (id integer PRIMARY KEY, org_id integer NOT NULL)`;
  yield* sql`CREATE TABLE shared_membership (id serial PRIMARY KEY, org_id integer NOT NULL, role text NOT NULL,
    status text NOT NULL, user_id integer NOT NULL, deleted_at bigint)`;
  yield* sql`INSERT INTO workspace_workspace (id, org_id) VALUES (1, 1), (2, 2)`;
});

const grant = (role: "owner" | "member") =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql`INSERT INTO shared_membership (org_id, role, status, user_id) VALUES (1, ${role}, 'active', 7)`
  );
const revoke = Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`UPDATE shared_membership SET deleted_at = 1 WHERE user_id = 7`
);

// One hosted model over PGlite membership; each entrypoint adds its own session adapter.
// Open subscriptions re-read grants only when `pause` completes: never, unless a test signals it.
const hosted = (kind: V.TransportKind, pause: Effect.Effect<void> = Effect.never) => {
  const model = VaultSyncModel.layer(VaultSyncPolicies).pipe(Layer.provide(Domain.InMemory));
  return layerVaultSyncTransportSession(kind).pipe(
    Layer.provideMerge(model),
    Layer.provideMerge(
      Layer.mergeAll(binding, VaultSyncMembershipLive, Layer.succeed(VaultSyncRevocationPause, pause))
    ),
    Layer.provideMerge(Layer.effectDiscard(schema)),
    Layer.provideMerge(Layer.fresh(PgliteTestLayer))
  );
};

// Views are projected asynchronously: re-read until the destination appears.
const settled = <E>(get: Effect.Effect<{ readonly destination: { readonly _tag: string } } | null, E>) =>
  // No clock wait: each read is an in-process RPC round trip that lets projection fibers run.
  get.pipe(
    Effect.repeat({
      until: (state) => state?.destination._tag === "Registered",
      times: 5000,
    })
  );

const expectDenied = Effect.fn("expectDenied")(function* <A, E extends { readonly _tag: string }>(
  effect: Effect.Effect<A, E>
) {
  const denied = yield* Effect.flip(effect);
  expect(denied._tag).toBe("ScopeDenied");
});

// Views are projected asynchronously; registration returns once both status Views caught up.
const register = Effect.gen(function* () {
  const destinations = yield* V.SyncDestination;
  const own1 = yield* destinations.send(own, V.RegisterDestination.make({ orgId: 1, workspaceId: 1, name: "own" }));
  yield* destinations.send(foreign, V.RegisterDestination.make({ orgId: 2, workspaceId: 2, name: "foreign" }));
  return { stream: own1.stream, version: own1.version };
});

const webApp = Effect.fn("webApp")(function* (kind: V.TransportKind, pause?: Effect.Effect<void>) {
  const base = hosted(kind, pause);
  const context = yield* Layer.build(base);
  yield* register.pipe(Effect.provideContext(context));
  const routes = Layer.mergeAll(
    HttpApiBuilder.layer(VaultSyncHttp.api).pipe(Layer.provide(VaultSyncHttp.layer)),
    VaultSyncRpcHttp
  ).pipe(
    Layer.provide(Layer.succeedContext(context)),
    Layer.provide(BunHttpPlatform.layer),
    Layer.provide(Etag.layer),
    Layer.provide(cliPlatform)
  );
  const app = yield* Effect.acquireRelease(
    Effect.sync(() => HttpRouter.toWebHandler(routes, { disableLogger: true })),
    (app) => Effect.promise(() => app.dispose())
  );
  const fetch = ((input: string | URL | Request, init?: RequestInit) =>
    app.handler(input instanceof Request ? input : new Request(`${input}`, init))) as typeof globalThis.fetch;
  return { app, context, fetch };
});

const decoder = new TextDecoder();

// Reads SSE frames from a live response; null once the server ends the stream.
const sseReader = (response: Response) => {
  const reader = response.body!.getReader();
  const buffer = { text: "" };
  const next: Effect.Effect<string | null> = Effect.gen(function* () {
    const index = Str.indexOf("\n\n")(buffer.text);
    if (O.isSome(index)) {
      const frame = Str.slice(0, index.value)(buffer.text);
      buffer.text = Str.slice(index.value + 2)(buffer.text);
      return frame;
    }
    const chunk = yield* Effect.promise(() => reader.read());
    if (chunk.done) return null;
    buffer.text += decoder.decode(chunk.value, { stream: true });
    return yield* next;
  });
  return { next };
};

const drain = Effect.fn("drain")(function* (next: Effect.Effect<string | null>) {
  const frames: Array<string> = [];
  for (;;) {
    const frame = yield* next.pipe(Effect.timeout("5 seconds"));
    if (frame === null) return frames;
    frames.push(frame);
  }
});

describe("vault-sync production session adapters", () => {
  it.effect("launch token is required and the route, not a header, fixes the transport kind", () =>
    Effect.gen(function* () {
      const context = yield* Layer.build(
        layerVaultSyncLaunchTokenResolver("http").pipe(
          Layer.provideMerge(VaultSyncModel.layer(VaultSyncPolicies).pipe(Layer.provide(Domain.InMemory))),
          Layer.provideMerge(Layer.mergeAll(binding, VaultSyncMembershipLive)),
          Layer.provideMerge(Layer.fresh(PgliteTestLayer))
        )
      );
      const resolver = Context.get(context, V.SessionResolver);
      const missing = yield* Effect.flip(resolver.resolve(Headers.empty));
      expect(missing._tag).toBe("ScopeDenied");
      const wrong = yield* Effect.flip(resolver.resolve(Headers.fromInput({ authorization: "Bearer guess" })));
      expect(wrong._tag).toBe("ScopeDenied");
      const request = yield* resolver.resolve(
        Headers.fromInput({ ...bearer, "x-correlation-id": "corr-1", "x-source-kind": "mcp" })
      );
      expect(request.sourceKind).toBe("http");
      expect(request.correlationId).toBe("corr-1");
      expect(request.principal).toEqual({ kind: "User", userId: 7 });
      expect(request.principalKey).toBe("User:7");
      // D17 F6: a header that is not a bounded token is replaced by a minted one.
      const unbounded = yield* resolver.resolve(
        Headers.fromInput({ ...bearer, "x-correlation-id": "clients/acme/matter brief.docx" })
      );
      expect(unbounded.correlationId).not.toContain("acme");
      expect(S.is(V.RequestToken)(unbounded.correlationId)).toBe(true);
    }).pipe(TestClock.withLive)
  );

  it.effect("local operator needs no credential but still reads live membership", () =>
    Effect.gen(function* () {
      const context = yield* Layer.build(
        VaultSyncSessionLive.pipe(
          Layer.provideMerge(VaultSyncLocalOperatorLive),
          Layer.provideMerge(VaultSyncModel.layer(VaultSyncPolicies).pipe(Layer.provide(Domain.InMemory))),
          Layer.provideMerge(Layer.mergeAll(binding, VaultSyncMembershipLive)),
          Layer.provideMerge(Layer.effectDiscard(schema)),
          Layer.provideMerge(Layer.fresh(PgliteTestLayer))
        )
      );
      yield* register.pipe(Effect.provideContext(context));
      const client = yield* VaultSyncApi.clientInProcess.pipe(Effect.provideContext(context));
      const before = yield* Effect.flip(client.VaultSyncStatus.get(own));
      expect(before._tag).toBe("ScopeDenied");
      yield* grant("member").pipe(Effect.provideContext(context));
      const status = yield* settled(client.VaultSyncStatus.get(own));
      expect(status?.destination._tag).toBe("Registered");
      const request = yield* Context.get(context, V.SessionResolver).resolve(Headers.empty);
      expect(request.sourceKind).toBe("cli");
    }).pipe(TestClock.withLive)
  );

  it.effect("live membership: member reads, diagnostics need owner, soft delete and foreign keys deny", () =>
    Effect.gen(function* () {
      const context = yield* Layer.build(hosted("http"));
      yield* register.pipe(Effect.provideContext(context));
      const client = yield* VaultSyncApi.clientInProcess.pipe(Effect.provideContext(context));
      const call = { headers: bearer };
      yield* grant("member").pipe(Effect.provideContext(context));
      const status = yield* settled(client.VaultSyncStatus.get(own, call));
      expect(status?.destination._tag).toBe("Registered");
      const list = yield* client.DestinationList.get(V.WorkspaceKey.make("1:1"), call);
      expect(list).not.toBeNull();
      const diagnostics = yield* Effect.flip(client.OperationQueue.get(own, call));
      expect(diagnostics._tag).toBe("ScopeDenied");
      yield* expectDenied(client.VaultSyncStatus.get(foreign, call));
      yield* expectDenied(client.OpenConflicts.get(foreign, call));
      yield* expectDenied(
        client.VaultSyncStatus.get(V.DestinationId.make("documents_sync_destination_aneverregistered"), call)
      );
      yield* expectDenied(client.DestinationList.get(V.WorkspaceKey.make("2:2"), call));
      yield* expectDenied(client.DestinationList.get(V.WorkspaceKey.make("1:2"), call));
      const unauthenticated = yield* Effect.flip(client.VaultSyncStatus.get(own));
      expect(unauthenticated._tag).toBe("ScopeDenied");
      yield* grant("owner").pipe(Effect.provideContext(context));
      const queue = yield* client.OperationQueue.get(own, call);
      expect(queue).toBeNull();
      yield* revoke.pipe(Effect.provideContext(context));
      const revoked = yield* Effect.flip(client.VaultSyncStatus.get(own, call));
      expect(revoked._tag).toBe("ScopeDenied");
    }).pipe(TestClock.withLive)
  );

  it.effect("public pass and probe initiators start durable workflows only for authorized callers", () =>
    Effect.gen(function* () {
      const starts = yield* Ref.make<ReadonlyArray<string>>([]);
      const model = InitiatorModel.layer(Layer.merge(VaultSyncRequestsLive, recordingPass)).pipe(
        Layer.provide(Layer.succeed(PassStarts, starts)),
        Layer.provide(Domain.InMemory)
      );
      const context = yield* Layer.build(
        layerVaultSyncTransportSession("http").pipe(
          Layer.provideMerge(model),
          Layer.provideMerge(Layer.mergeAll(binding, VaultSyncMembershipLive)),
          Layer.provideMerge(Layer.effectDiscard(schema)),
          Layer.provideMerge(Layer.fresh(PgliteTestLayer))
        )
      );
      yield* register.pipe(Effect.provideContext(context));
      yield* grant("member").pipe(Effect.provideContext(context));
      const client = yield* VaultSyncApi.clientInProcess.pipe(Effect.provideContext(context));
      const call = { headers: bearer };
      const foreignPass = yield* Effect.flip(client.RequestVaultSync(foreign, { requestId: "r0" }, call));
      expect(foreignPass._tag).toBe("ScopeDenied");
      const anonymous = yield* Effect.flip(client.ProbeDestination(own, { requestId: "r0" }));
      expect(anonymous._tag).toBe("ScopeDenied");
      yield* client.RequestVaultSync(own, { requestId: "r1" }, call);
      yield* client.ProbeDestination(own, { requestId: "r2" }, call);
      const started = yield* Ref.get(starts).pipe(
        Effect.repeat({ until: (value) => value.length >= 2, times: 200 }),
        Effect.delay("5 millis")
      );
      expect(A.sort(started, Order.String)).toEqual([
        `pass:${own}/VaultSyncRequested/r1`,
        `probe:${own}/DestinationProbeRequested/r2`,
      ]);
      yield* client.PauseDestination(own, {}, call);
      const paused = yield* Effect.flip(client.RequestVaultSync(own, { requestId: "r3" }, call));
      expect(paused._tag).toBe("SyncRuleViolation");
    }).pipe(TestClock.withLive)
  );
});

describe("revocation barrier over real transports", () => {
  it.effect("HTTP SSE watch: no frame after revocation commits, then a typed denial ends the stream", () =>
    Effect.gen(function* () {
      const { app, context } = yield* webApp("http");
      yield* grant("member").pipe(Effect.provideContext(context));
      const response = yield* Effect.promise(() =>
        app.handler(new Request(`http://test/VaultSyncStatus/${own}/watch`, { headers: bearer }))
      );
      expect(response.status).toBe(200);
      const sse = sseReader(response);
      // The first frames may precede the projection; wait for the registered state.
      const first = yield* sse.next.pipe(
        Effect.repeat({ until: (frame) => frame === null || Str.includes("Registered")(frame) })
      );
      expect(first).toContain("Registered");
      yield* revoke.pipe(Effect.provideContext(context));
      // A commit right after the barrier must not reach the client.
      const destinations = Context.get(context, V.SyncDestination);
      yield* destinations.send(
        own,
        V.ResolveDestinationRoot.make({ rootId: V.RemoteItemId.make("root-after-barrier") })
      );
      const after = yield* drain(sse.next);
      expect(A.filter(after, Str.includes("root-after-barrier"))).toEqual([]);
      expect(A.join(after, "\n")).toContain("ScopeDenied");
    }).pipe(TestClock.withLive)
  );

  it.effect("HTTP SSE watch: an idle subscription closes with a typed denial after revocation", () =>
    Effect.gen(function* () {
      // The idle stream has no frame to check, so only the grant re-read can end it; signal it explicitly.
      const membershipChanged = yield* Deferred.make<void>();
      const { app, context } = yield* webApp("http", Deferred.await(membershipChanged));
      yield* grant("member").pipe(Effect.provideContext(context));
      const response = yield* Effect.promise(() =>
        app.handler(new Request(`http://test/OpenConflicts/${own}/watch`, { headers: bearer }))
      );
      const sse = sseReader(response);
      yield* sse.next;
      yield* revoke.pipe(Effect.provideContext(context));
      yield* Deferred.succeed(membershipChanged, undefined);
      const rest = yield* drain(sse.next);
      expect(A.join(rest, "\n")).toContain("ScopeDenied");
    }).pipe(TestClock.withLive)
  );

  it.effect("HTTP history: a foreign or revoked reader receives no history page or marker", () =>
    Effect.gen(function* () {
      const { app, context } = yield* webApp("http");
      yield* grant("member").pipe(Effect.provideContext(context));
      const foreignEvents = yield* Effect.promise(() =>
        app.handler(new Request(`http://test/VaultSyncStatus/${foreign}/events?after=0`, { headers: bearer }))
      );
      expect(foreignEvents.status).toBe(403);
      yield* revoke.pipe(Effect.provideContext(context));
      const revokedList = yield* Effect.promise(() =>
        app.handler(
          new Request(`http://test/VaultSyncStatus/${own}/list?order=asc&take=10&after=0`, { headers: bearer })
        )
      );
      expect(revokedList.status).toBe(403);
      const body = yield* Effect.promise(() => revokedList.json());
      expect(body).toEqual({ _tag: "ScopeDenied" });
    }).pipe(TestClock.withLive)
  );

  it.effect("gated RPC stream (remote CLI protocol): revocation fails the watch with no later frame", () =>
    Effect.gen(function* () {
      const { context, fetch } = yield* webApp("http");
      yield* grant("member").pipe(Effect.provideContext(context));
      const http = yield* Layer.build(
        FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)))
      );
      const client = yield* VaultSyncApi.clientHttp(`http://test${VAULT_SYNC_RPC_PATH}`).pipe(
        Effect.provideContext(http)
      );
      // Subscribe once the projection settled, so the only later change is the post-barrier commit.
      yield* settled(client.VaultSyncStatus.get(own, { headers: bearer }));
      const frames = yield* Ref.make(0);
      const afterBarrier = yield* Ref.make(0);
      const revoked = yield* Ref.make(false);
      const destinations = Context.get(context, V.SyncDestination);
      const failure = yield* client.VaultSyncStatus.watch(own, { headers: bearer }).pipe(
        Stream.runForEach(() =>
          Effect.gen(function* () {
            const count = yield* Ref.updateAndGet(frames, (n) => n + 1);
            if (yield* Ref.get(revoked)) yield* Ref.update(afterBarrier, (n) => n + 1);
            if (count === 1) {
              yield* revoke.pipe(Effect.provideContext(context));
              yield* Ref.set(revoked, true);
              yield* destinations.send(
                own,
                V.ResolveDestinationRoot.make({ rootId: V.RemoteItemId.make("root-after-barrier") })
              );
            }
          })
        ),
        Effect.flip,
        Effect.timeout("10 seconds")
      );
      expect(failure._tag === "RpcClientError" ? failure : failure._tag).toBe("ScopeDenied");
      const delivered = yield* Ref.get(frames);
      const leaked = yield* Ref.get(afterBarrier);
      expect(delivered).toBe(1);
      expect(leaked).toBe(0);
    }).pipe(TestClock.withLive)
  );

  it.effect("MCP Views-only adapter: a read is allowed before revocation and denied after it", () =>
    Effect.gen(function* () {
      const base = hosted("mcp");
      const context = yield* Layer.build(base);
      yield* register.pipe(Effect.provideContext(context));
      yield* grant("member").pipe(Effect.provideContext(context));
      const harness = layerConformanceHttp({
        name: "vault-sync-revocation",
        version: "0.0.0",
        instructions: "Read only",
        registrations: VaultSyncMcpLive.pipe(Layer.provide(Layer.succeedContext(context))),
        tool: { name: "VaultSyncApi_VaultSyncStatus_get", arguments: { key: own }, invalidArguments: {} },
      });
      const http = yield* Layer.build(harness);
      const raw = Context.get(http, ConformanceHttp);
      const authorized = ConformanceHttp.of({
        ...raw,
        httpClient: HttpClient.mapRequest(raw.httpClient, HttpClientRequest.setHeaders(bearer)),
      });
      const { rpc } = yield* connectHttp().pipe(Effect.provideService(ConformanceHttp, authorized));
      const allowed = yield* rpc["tools/call"]({ name: "VaultSyncApi_VaultSyncStatus_get", arguments: { key: own } });
      expect(allowed.isError).not.toBe(true);
      yield* revoke.pipe(Effect.provideContext(context));
      const denied = yield* rpc["tools/call"]({ name: "VaultSyncApi_VaultSyncStatus_get", arguments: { key: own } });
      expect(denied.isError).toBe(true);
      expect(denied.content).toEqual(
        expect.arrayContaining([expect.objectContaining({ text: expect.stringContaining("ScopeDenied") })])
      );
      const commandTool = yield* rpc["tools/call"]({
        name: "VaultSyncApi_RequestVaultSync",
        arguments: { target: own, input: { requestId: "x" } },
      }).pipe(Effect.exit);
      expect(commandTool._tag === "Failure" || commandTool.value.isError === true).toBe(true);
    }).pipe(TestClock.withLive)
  );
});

describe("remote CLI over the gated sidecar endpoint", () => {
  it.effect("presents the launch token; without it the generated command is rejected", () =>
    Effect.gen(function* () {
      const { context, fetch } = yield* webApp("http");
      yield* grant("member").pipe(Effect.provideContext(context));
      const platform = yield* Layer.build(
        Layer.mergeAll(
          FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch))),
          cliPlatform
        )
      );
      const run = (headers: Readonly<Record<string, string>>, args: ReadonlyArray<string>) =>
        Command.runWith(vaultSyncRemoteCli<never, never>({ url: `http://test${VAULT_SYNC_RPC_PATH}`, headers }), {
          version: "test",
          renderErrors: false,
        })(args).pipe(Effect.provideContext(platform));
      yield* run(bearer, ["vault-sync-status", "get", "--key", own]);
      const anonymous = yield* Effect.flip(run({}, ["vault-sync-status", "get", "--key", own]));
      expect(anonymous._tag).toBe("CallRejected");
      const guessed = yield* Effect.flip(run(bearer, ["vault-sync-status", "get", "--key", foreign]));
      expect(guessed._tag).toBe("CallRejected");
    }).pipe(TestClock.withLive)
  );
});
