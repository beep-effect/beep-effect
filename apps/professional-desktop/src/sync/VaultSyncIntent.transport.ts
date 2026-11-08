/**
 * Renderer-to-sidecar transport for vault-sync intents over the protected vault-sync Api.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { resolveChatRpcHttpUrl } from "@beep/agents-client/Chat.layer";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { VaultSyncApi } from "@beep/documents-use-cases/aggregates/VaultSync";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as H from "effect/HashMap";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { VaultSyncAction, VaultSyncRefusalReason } from "./VaultSyncIntent.model.ts";
import { VaultSyncServerState } from "./VaultSyncIntent.prediction.ts";
import type { VaultSyncIntent } from "./VaultSyncIntent.model.ts";

const $I = $ProfessionalDesktopId.create("sync/VaultSyncIntent.transport");

/**
 * The sidecar path that serves the vault-sync Api's RPC protocol.
 *
 * **Details**
 *
 * Mirrors `VAULT_SYNC_RPC_PATH` in `@beep/documents-server`, which the renderer must not import.
 * A test pins the two together.
 *
 * **Example** (Read the Api path)
 *
 * ```ts
 * import { VAULT_SYNC_API_PATH } from "@/sync/VaultSyncIntent.transport"
 *
 * console.log(VAULT_SYNC_API_PATH) // "/vault-sync/rpc"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VAULT_SYNC_API_PATH = "/vault-sync/rpc" as const;

/**
 * Organization the desktop sidecar binds its launch principal to.
 *
 * **Details**
 *
 * The sidecar's launch binding acts for organization 1; the destination list is keyed by
 * organization and workspace.
 *
 * @category configuration
 * @since 0.0.0
 */
const DESKTOP_VAULT_SYNC_ORG_ID = 1;

/**
 * The sidecar did not answer, so the intent's outcome is unknown and it stays queued.
 *
 * **Details**
 *
 * A write may have committed before the answer was lost; the replay resends the same command id
 * and the server returns the first receipt instead of deciding again.
 *
 * **Example** (Build the unknown-outcome error)
 *
 * ```ts
 * import { VaultSyncUnreachable } from "@/sync/VaultSyncIntent.transport"
 *
 * console.log(VaultSyncUnreachable.make({})._tag) // "VaultSyncUnreachable"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VaultSyncUnreachable extends S.TaggedError<VaultSyncUnreachable, { readonly brand: unique symbol }>(
  $I`VaultSyncUnreachable`
)(
  "VaultSyncUnreachable",
  {},
  $I.annote("VaultSyncUnreachable", {
    description: "The vault-sync Api did not answer; the outcome is unknown.",
  })
) {}

/**
 * The sidecar refused the call with a typed rejection or session denial.
 *
 * **Example** (Wrap a rule violation)
 *
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync"
 * import { VaultSyncRefused } from "@/sync/VaultSyncIntent.transport"
 *
 * const refused = VaultSyncRefused.make({
 *   reason: V.SyncRuleViolation.make({ rule: "destination-paused", evidence: "destination state" }),
 * })
 * console.log(refused.reason._tag) // "SyncRuleViolation"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
// fallow-ignore-next-line unused-export -- declaration emit names this branded error in the inferred types of the exported intent atoms (TS2527 otherwise). Owner: @beep/professional-desktop. Exit: remove when those atoms carry explicit type annotations.
export class VaultSyncRefused extends S.TaggedError<VaultSyncRefused, { readonly brand: unique symbol }>(
  $I`VaultSyncRefused`
)(
  "VaultSyncRefused",
  { reason: VaultSyncRefusalReason },
  $I.annote("VaultSyncRefused", {
    description: "The vault-sync Api refused a command or read with a typed reason.",
  })
) {}

const isRefusalReason = S.is(VaultSyncRefusalReason);

const classify = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, VaultSyncUnreachable | VaultSyncRefused, R> =>
  effect.pipe(
    Effect.mapError((error: E): VaultSyncUnreachable | VaultSyncRefused =>
      isRefusalReason(error) ? VaultSyncRefused.make({ reason: error }) : VaultSyncUnreachable.make({})
    ),
    // A command defect is an unknown outcome too: retry it with the same id.
    Effect.catchDefect(() => Effect.fail(VaultSyncUnreachable.make({})))
  );

/**
 * Reads the destination state and delivers intents for the vault-sync panel.
 *
 * **Example** (Service key)
 *
 * ```ts
 * import { VaultSyncIntentTransport } from "@/sync/VaultSyncIntent.transport"
 *
 * console.log(typeof VaultSyncIntentTransport.key) // "string"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class VaultSyncIntentTransport extends Context.Service<
  VaultSyncIntentTransport,
  {
    /** The workspace's destination and open conflicts, or none before genesis registers one. */
    readonly read: (
      workspaceId: number
    ) => Effect.Effect<O.Option<VaultSyncServerState>, VaultSyncUnreachable | VaultSyncRefused>;
    /** Send one intent with its stable command id. */
    readonly send: (intent: VaultSyncIntent) => Effect.Effect<void, VaultSyncUnreachable | VaultSyncRefused>;
  }
>()($I`VaultSyncIntentTransport`) {}

const unregistered: V.DestinationState = { _tag: "Unregistered" };

const makeApiTransport = Effect.gen(function* () {
  const client = yield* VaultSyncApi.Client;
  const send = (intent: VaultSyncIntent) => {
    const options = { commandId: intent.commandId };
    return classify(
      VaultSyncAction.match(intent.action, {
        "request-sync": () => client.RequestVaultSync(intent.destinationId, { requestId: intent.commandId }, options),
        probe: () => client.ProbeDestination(intent.destinationId, { requestId: intent.commandId }, options),
        pause: () => client.PauseDestination(intent.destinationId, {}, options),
        resume: () => client.ResumeDestination(intent.destinationId, {}, options),
        "review-conflict": (review) =>
          client.ReviewConflict(
            review.conflictId,
            {
              remoteEventId: review.remoteEventId,
              workspaceId: review.workspaceId,
              destinationId: intent.destinationId,
              correction: null,
              healOperationId: review.healOperationId,
            },
            options
          ),
      })
    ).pipe(Effect.asVoid);
  };
  const read = Effect.fn("documents.vault_sync.intent.read")(function* (workspaceId: number) {
    const list = yield* classify(
      client.DestinationList.get(V.WorkspaceKey.make(`${DESKTOP_VAULT_SYNC_ORG_ID}:${workspaceId}`))
    );
    // Genesis creates one destination per workspace and provider; pick it deterministically.
    const first = O.fromNullOr(list).pipe(O.getOrElse(H.empty), H.keys, A.fromIterable, A.sort(Order.String), A.head);
    if (O.isNone(first)) return O.none<VaultSyncServerState>();
    const destinationId = first.value;
    const status = yield* classify(client.VaultSyncStatus.get(destinationId));
    const open = yield* classify(client.OpenConflicts.get(destinationId));
    return O.some(
      VaultSyncServerState.make({
        destinationId,
        destination: status?.destination ?? unregistered,
        conflicts: open ?? H.empty(),
      })
    );
  });
  return VaultSyncIntentTransport.of({ read, send });
});

/**
 * The vault-sync Api URL on the sidecar, on the same origin rule as the chat RPC URL.
 *
 * **Example** (Resolve against a dev-server origin)
 *
 * ```ts
 * import { resolveVaultSyncApiUrl } from "@/sync/VaultSyncIntent.transport"
 *
 * console.log(resolveVaultSyncApiUrl({ location: { origin: "http://127.0.0.1:1421" } }))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const resolveVaultSyncApiUrl = (runtime?: Parameters<typeof resolveChatRpcHttpUrl>[0]): string =>
  pipe(resolveChatRpcHttpUrl(runtime), Str.replace(/\/rpc$/, VAULT_SYNC_API_PATH));

/**
 * Where the renderer reaches the vault-sync Api and the launch token that authenticates it.
 *
 * **Example** (Describe the dev-server connection)
 *
 * ```ts
 * import { VaultSyncApiConnection } from "@/sync/VaultSyncIntent.transport"
 *
 * const connection = VaultSyncApiConnection.make({ url: "/vault-sync/rpc", token: "launch-token" })
 * console.log(connection.url) // "/vault-sync/rpc"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VaultSyncApiConnection extends S.Opaque<VaultSyncApiConnection, { readonly brand: unique symbol }>()(
  S.Struct({ url: S.NonEmptyString, token: S.NonEmptyString }).pipe(
    $I.annoteSchema("VaultSyncApiConnection", {
      description: "The vault-sync Api URL on the sidecar and the per-launch session token.",
    })
  )
) {}

/**
 * The vault-sync Api transport over the sidecar's launch-token-gated RPC endpoint.
 *
 * **Example** (Build the layer)
 *
 * ```ts
 * import * as Layer from "effect/Layer"
 * import { layerVaultSyncIntentTransportHttp, VaultSyncApiConnection } from "@/sync/VaultSyncIntent.transport"
 *
 * const connection = VaultSyncApiConnection.make({ url: "/vault-sync/rpc", token: "t" })
 * console.log(Layer.isLayer(layerVaultSyncIntentTransportHttp(connection)))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerVaultSyncIntentTransportHttp = (options: VaultSyncApiConnection) =>
  Layer.effect(VaultSyncIntentTransport, makeApiTransport).pipe(
    Layer.provide(VaultSyncApi.layerClient),
    Layer.provide(
      RpcClient.layerProtocolHttp({
        url: options.url,
        transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.bearerToken(options.token)),
      })
    ),
    Layer.provide([RpcSerialization.layerNdjson, FetchHttpClient.layer])
  );

/**
 * The vault-sync Api transport over an already provided Api client, for in-process hosts.
 *
 * **Example** (Inspect the in-process layer)
 *
 * ```ts
 * import * as Layer from "effect/Layer"
 * import { layerVaultSyncIntentTransport } from "@/sync/VaultSyncIntent.transport"
 *
 * console.log(Layer.isLayer(layerVaultSyncIntentTransport)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerVaultSyncIntentTransport = Layer.effect(VaultSyncIntentTransport, makeApiTransport);

/**
 * A transport for sessions without desktop RPC access: every call is unreachable.
 *
 * **Example** (Every read is unreachable)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { VaultSyncIntentTransport, VaultSyncIntentTransportUnavailable } from "@/sync/VaultSyncIntent.transport"
 *
 * const error = Effect.gen(function* () {
 *   const transport = yield* VaultSyncIntentTransport
 *   return yield* Effect.flip(transport.read(1))
 * }).pipe(Effect.provide(VaultSyncIntentTransportUnavailable), Effect.runSync)
 * console.log(error._tag) // "VaultSyncUnreachable"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const VaultSyncIntentTransportUnavailable = Layer.succeed(
  VaultSyncIntentTransport,
  VaultSyncIntentTransport.of({
    read: Effect.fn("VaultSyncIntentTransport.unavailable.read")(function* () {
      return yield* VaultSyncUnreachable.make({});
    }),
    send: Effect.fn("VaultSyncIntentTransport.unavailable.send")(function* () {
      return yield* VaultSyncUnreachable.make({});
    }),
  })
);
