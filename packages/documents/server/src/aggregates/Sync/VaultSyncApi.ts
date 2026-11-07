/**
 * Authenticated API hosting and final delivery authorization.
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Http from "@alchemy.run/domain/Http";
import { Correlation } from "@alchemy.run/domain/Telemetry";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { VaultSyncApi } from "@beep/documents-use-cases/aggregates/VaultSync";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Headers from "effect/http/Headers";
import * as HttpRouter from "effect/http/HttpRouter";
import * as OpenApi from "effect/http-api/OpenApi";
import * as Layer from "effect/Layer";
import * as R from "effect/Record";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";
import * as Stream from "effect/Stream";

/**
 * Resolve verified identity and preflight live scope before any RPC handler runs.
 *
 * **Example** (Inspect adapter)
 * ```ts
 * import { VaultSyncSessionLive } from "@beep/documents-server/aggregates/Sync";
 * void VaultSyncSessionLive;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const VaultSyncSessionLive = Layer.effect(
  V.Session,
  Effect.gen(function* () {
    const resolver = yield* V.SessionResolver;
    return V.Session.of(
      Effect.fnUntraced(function* (effect, { rpc, payload, headers }) {
        const request = yield* resolver.resolve(headers);
        return yield* V.authorizeVaultSync(rpc._tag, payload).pipe(
          Effect.andThen(effect),
          Effect.raceFirst(resolver.revoked(request)),
          Effect.provideService(V.VaultSyncRequestContext, request),
          Effect.provideService(V.SessionResolver, resolver),
          Effect.provideService(Correlation, { id: request.correlationId })
        );
      })
    );
  })
);

/**
 * Path of the gated remote CLI RPC endpoint on the sidecar.
 *
 * **Example** (Read the path)
 * ```ts
 * import { VAULT_SYNC_RPC_PATH } from "@beep/documents-server/aggregates/Sync";
 * console.log(VAULT_SYNC_RPC_PATH);
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const VAULT_SYNC_RPC_PATH = "/vault-sync/rpc" as const;

const deliveryCheck = Effect.fn("VaultSync.deliveryCheck")(function* (
  rpc: string,
  key: unknown,
  headers: Headers.Input
) {
  const resolver = yield* V.SessionResolver;
  const request = yield* resolver.resolve(Headers.fromInput(headers));
  yield* V.authorizeVaultSync(rpc, { key }).pipe(
    Effect.provideService(V.VaultSyncRequestContext, request),
    Effect.provideService(V.SessionResolver, resolver)
  );
});

/**
 * Check each frame, including CaughtUp, after upstream buffering; end idle streams on revocation.
 *
 * **Example** (Inspect adapter)
 * ```ts
 * import { authorizeVaultSyncDelivery } from "@beep/documents-server/aggregates/Sync";
 * void authorizeVaultSyncDelivery;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const authorizeVaultSyncDelivery: {
  (
    rpc: string,
    key: unknown,
    headers: Headers.Input
  ): <A, E, R>(source: Stream.Stream<A, E, R>) => Stream.Stream<A, E | V.ScopeDenied, R | V.SessionResolver>;
  <A, E, R>(
    source: Stream.Stream<A, E, R>,
    rpc: string,
    key: unknown,
    headers: Headers.Input
  ): Stream.Stream<A, E | V.ScopeDenied, R | V.SessionResolver>;
} = dual(4, <A, E, R>(source: Stream.Stream<A, E, R>, rpc: string, key: unknown, headers: Headers.Input) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const resolver = yield* V.SessionResolver;
      const request = yield* resolver.resolve(Headers.fromInput(headers));
      yield* deliveryCheck(rpc, key, headers);
      return source.pipe(
        Stream.rechunk(1),
        Stream.mapEffect((frame) => deliveryCheck(rpc, key, headers).pipe(Effect.as(frame))),
        Stream.interruptWhen(resolver.revoked(request))
      );
    })
  )
);

type ApiClient = Effect.Success<typeof VaultSyncApi.clientInProcess>;
type ViewName = "VaultSyncStatus" | "OpenConflicts" | "DestinationList" | "OperationQueue";
type DeliveryClient = Omit<ApiClient, ViewName> & {
  readonly [K in ViewName]: Omit<ApiClient[K], "watch" | "events"> & {
    readonly watch: (
      ...args: Parameters<ApiClient[K]["watch"]>
    ) => Stream.Stream<
      Stream.Success<ReturnType<ApiClient[K]["watch"]>>,
      Stream.Error<ReturnType<ApiClient[K]["watch"]>>,
      V.SessionResolver
    >;
    readonly events: (
      ...args: Parameters<ApiClient[K]["events"]>
    ) => Stream.Stream<
      Stream.Success<ReturnType<ApiClient[K]["events"]>>,
      Stream.Error<ReturnType<ApiClient[K]["events"]>>,
      V.SessionResolver
    >;
  };
};

/**
 * Protected in-process client used by HTTP and MCP adapters; do not append a downstream buffer.
 *
 * **Example** (Inspect adapter)
 * ```ts
 * import { VaultSyncDeliveryClient } from "@beep/documents-server/aggregates/Sync";
 * void VaultSyncDeliveryClient;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const VaultSyncDeliveryClient: Effect.Effect<
  DeliveryClient,
  never,
  Effect.Services<typeof VaultSyncApi.clientInProcess>
> = VaultSyncApi.clientInProcess.pipe(
  Effect.map((client) => ({
    ...client,
    VaultSyncStatus: {
      ...client.VaultSyncStatus,
      watch: (...args: Parameters<typeof client.VaultSyncStatus.watch>) =>
        authorizeVaultSyncDelivery(
          client.VaultSyncStatus.watch(...args),
          "VaultSyncStatus.watch",
          args[0],
          args[1]?.headers ?? {}
        ),
      events: (...args: Parameters<typeof client.VaultSyncStatus.events>) =>
        authorizeVaultSyncDelivery(
          client.VaultSyncStatus.events(...args),
          "VaultSyncStatus.events",
          args[0],
          args[1]?.headers ?? {}
        ),
    },
    OpenConflicts: {
      ...client.OpenConflicts,
      watch: (...args: Parameters<typeof client.OpenConflicts.watch>) =>
        authorizeVaultSyncDelivery(
          client.OpenConflicts.watch(...args),
          "OpenConflicts.watch",
          args[0],
          args[1]?.headers ?? {}
        ),
      events: (...args: Parameters<typeof client.OpenConflicts.events>) =>
        authorizeVaultSyncDelivery(
          client.OpenConflicts.events(...args),
          "OpenConflicts.events",
          args[0],
          args[1]?.headers ?? {}
        ),
    },
    DestinationList: {
      ...client.DestinationList,
      watch: (...args: Parameters<typeof client.DestinationList.watch>) =>
        authorizeVaultSyncDelivery(
          client.DestinationList.watch(...args),
          "DestinationList.watch",
          args[0],
          args[1]?.headers ?? {}
        ),
      events: (...args: Parameters<typeof client.DestinationList.events>) =>
        authorizeVaultSyncDelivery(
          client.DestinationList.events(...args),
          "DestinationList.events",
          args[0],
          args[1]?.headers ?? {}
        ),
    },
    OperationQueue: {
      ...client.OperationQueue,
      watch: (...args: Parameters<typeof client.OperationQueue.watch>) =>
        authorizeVaultSyncDelivery(
          client.OperationQueue.watch(...args),
          "OperationQueue.watch",
          args[0],
          args[1]?.headers ?? {}
        ),
      events: (...args: Parameters<typeof client.OperationQueue.events>) =>
        authorizeVaultSyncDelivery(
          client.OperationQueue.events(...args),
          "OperationQueue.events",
          args[0],
          args[1]?.headers ?? {}
        ),
    },
  }))
);

/**
 * HTTP endpoints and OpenAPI derived from the single API and its protected delivery client.
 *
 * **Example** (Inspect adapter)
 * ```ts
 * import { VaultSyncHttp } from "@beep/documents-server/aggregates/Sync";
 * void VaultSyncHttp;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const VaultSyncHttp = Http.toHttpApi({
  apiName: VaultSyncApi.apiName,
  serves: VaultSyncApi.serves,
  group: VaultSyncApi.group,
  clientInProcess: VaultSyncDeliveryClient,
});

/**
 * OpenAPI document for the same HTTP contract.
 *
 * **Example** (Inspect adapter)
 * ```ts
 * import { vaultSyncOpenApi } from "@beep/documents-server/aggregates/Sync";
 * void vaultSyncOpenApi;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const vaultSyncOpenApi = OpenApi.fromApi(VaultSyncHttp.api);

type Forward = (payload: never, options: { readonly headers: Headers.Headers }) => unknown;
type Flat = Record<string, (...args: ReadonlyArray<unknown>) => unknown>;
const viewMethods = ["get", "watch", "events", "list", "snapshot"] as const;

// Every RPC of the Api forwards to the protected delivery client with the caller's headers,
// so Session runs again inside and watch/events pass the per-frame gate. The raw Api fetch,
// whose streams bypass that gate, is never mounted.
const gatedHandlers = (client: DeliveryClient): Record<string, Forward> => {
  const flat = client as unknown as Record<string, Flat | ((...args: ReadonlyArray<unknown>) => unknown)>;
  return R.fromEntries(
    A.flatMap(VaultSyncApi.serves, (entry): ReadonlyArray<readonly [string, Forward]> => {
      if (entry.kind === "Command") {
        const send = flat[entry.tag] as (...args: ReadonlyArray<unknown>) => unknown;
        return [
          [
            entry.tag,
            ((
              {
                target,
                commandId,
                input,
              }: { readonly target: unknown; readonly commandId?: string; readonly input: unknown },
              { headers }
            ) => send(target, input, commandId === undefined ? { headers } : { commandId, headers })) as Forward,
          ],
        ];
      }
      const name = entry.kind === "View" ? entry.viewName : "";
      const reads = flat[name] as Flat;
      return A.map(viewMethods, (method): readonly [string, Forward] => [
        `${name}.${method}`,
        (({ key, ...rest }: { readonly key: unknown }, { headers }) =>
          reads[method]!(key, { ...rest, headers })) as Forward,
      ]);
    })
  );
};

/**
 * HTTP RPC endpoint for the generated remote CLI, authenticated by the launch token.
 *
 * **Details**
 *
 * Each RPC is served through {@link VaultSyncDeliveryClient}, never through the unwrapped Api fetch.
 *
 * **Example** (Inspect RPC hosting)
 * ```ts
 * import { VaultSyncRpcHttp } from "@beep/documents-server/aggregates/Sync";
 * void VaultSyncRpcHttp;
 * ```
 * @category layers
 * @since 0.0.0
 */
export const VaultSyncRpcHttp = Layer.unwrap(
  pipe(
    VaultSyncApi.group,
    RpcServer.toHttpEffect,
    Effect.map((serve) => HttpRouter.add("POST", VAULT_SYNC_RPC_PATH, serve))
  )
).pipe(
  Layer.provide([
    Layer.unwrap(
      Effect.map(VaultSyncDeliveryClient, (client) => VaultSyncApi.group.toLayer(gatedHandlers(client) as never))
    ),
    RpcSerialization.layerNdjson,
  ])
);
