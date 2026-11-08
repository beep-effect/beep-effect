/**
 * Production launch-token and local-operator SessionResolver adapters.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { $DocumentsServerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Headers from "effect/http/Headers";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Random from "effect/Random";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { annotateVaultSyncOutcome, VaultSyncAttribute } from "./VaultSync.instruments.ts";
import { VaultSyncSessionLive } from "./VaultSyncApi.ts";
import { VaultSyncMembership } from "./VaultSyncSession.repository.ts";

// Minted correlation ids are random opaque tokens, never derived from caller text.
const mintCorrelationId = Effect.zipWith(
  Clock.currentTimeMillis,
  Random.nextIntBetween(0, 2_147_483_647),
  (at, salt) => `corr_${at.toString(36)}_${salt.toString(36)}`
);
const $I = $DocumentsServerId.create("aggregates/Sync/VaultSyncSession");
const KeyInput = S.Struct({ key: S.Union([S.String, S.Struct({ id: S.String })]) });
const CommandInput = S.Struct({ target: S.String });
const NameInput = S.Struct({
  input: S.Struct({
    claim: S.Struct({
      destinationId: V.DestinationId,
      orgId: S.Int,
      workspaceId: S.Int,
    }),
  }),
});
const RecordInput = S.Struct({ input: S.Struct({ record: S.Struct({ destinationId: V.DestinationId }) }) });
const ScopeParts = S.Tuple([S.FiniteFromString, S.FiniteFromString]);

/**
 * Trusted launch binding. Hosts supply the same token and principal as the desktop.
 *
 * **Example** (Inspect launch binding)
 * ```ts
 * import { VaultSyncSessionBinding } from "@beep/documents-server/aggregates/Sync";
 * void VaultSyncSessionBinding;
 * ```
 * @category services
 * @since 0.0.0
 */
export class VaultSyncSessionBinding extends Context.Service<
  VaultSyncSessionBinding,
  {
    readonly request: V.VaultSyncRequest;
    readonly token: Redacted.Redacted<string>;
  }
>()($I`VaultSyncSessionBinding`) {}

const decode = <T extends S.Top>(schema: T, value: unknown) =>
  S.decodeUnknownEffect(schema)(value).pipe(Effect.mapError(() => V.ScopeDenied.make({})));

/**
 * How often an open subscription re-reads live grants to end idle streams after revocation.
 *
 * **Example** (Read the interval)
 * ```ts
 * import { VAULT_SYNC_REVOCATION_POLL } from "@beep/documents-server/aggregates/Sync";
 * console.log(VAULT_SYNC_REVOCATION_POLL);
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const VAULT_SYNC_REVOCATION_POLL = "250 millis" as const;

/**
 * Wait between live grant re-reads on an open subscription; sleeps `VAULT_SYNC_REVOCATION_POLL` by default.
 *
 * **Details**
 *
 * Adapters read it once when they are built. A host or test may provide an explicit signal instead
 * of a timer, so an idle stream re-checks membership exactly when the caller says it changed.
 *
 * **Example** (Re-check only when a signal fires)
 * ```ts
 * import { VaultSyncRevocationPause } from "@beep/documents-server/aggregates/Sync";
 * import * as Deferred from "effect/Deferred";
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 * const program = Effect.gen(function* () {
 *   const changed = yield* Deferred.make<void>();
 *   return Layer.succeed(VaultSyncRevocationPause, Deferred.await(changed));
 * });
 * void program;
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const VaultSyncRevocationPause = Context.Reference<Effect.Effect<void>>($I`VaultSyncRevocationPause`, {
  defaultValue: () => Effect.sleep(VAULT_SYNC_REVOCATION_POLL),
});

const authenticatedBy = LiteralKit(["launch-token", "channel"]);
type AuthenticatedBy = typeof authenticatedBy.Type;

const makeResolver = Effect.fnUntraced(function* (sourceKind: V.TransportKind, by: AuthenticatedBy) {
  const binding = yield* VaultSyncSessionBinding;
  const memberships = yield* VaultSyncMembership;
  const destinations = yield* V.SyncDestination;
  const conflicts = yield* V.SyncConflict;
  const pause = yield* VaultSyncRevocationPause;
  // Every Session span records the entrypoint's fixed transport and its own outcome.
  const traced = { attributes: { [VaultSyncAttribute.transport]: sourceKind } };
  const grants = Effect.fn("VaultSyncSession.grants", traced)(function* (request: V.VaultSyncRequest) {
    if (request.principal.kind !== "User") return yield* V.ScopeDenied.make({});
    return yield* memberships.read(request.principal.userId, V.VaultSyncScope.make(request));
  }, annotateVaultSyncOutcome);
  const registered = Effect.fn("VaultSyncSession.registered", traced)(function* (destinationId: V.DestinationId) {
    const state = yield* destinations.state(destinationId);
    if (state._tag !== "Registered") return yield* V.ScopeDenied.make({});
    return V.VaultSyncScope.make(state);
  }, annotateVaultSyncOutcome);
  // A conflict's scope is its destination's, and the two must agree on the workspace.
  const conflictScope = Effect.fn("VaultSyncSession.conflictScope")(function* (id: string) {
    const conflictId = yield* decode(V.ConflictId, id);
    const conflict = yield* conflicts.state(conflictId);
    if (conflict === null) return yield* V.ScopeDenied.make({});
    const owner = yield* registered(conflict.destinationId);
    if (owner.workspaceId !== conflict.workspaceId) return yield* V.ScopeDenied.make({});
    return owner;
  });
  const scope = Effect.fn("VaultSyncSession.scope", traced)(function* (rpc: string, payload: unknown) {
    if (rpc === "ClaimDestinationName") {
      const {
        input: { claim },
      } = yield* decode(NameInput, payload);
      // Registration has no existing destination; membership of the claimed workspace is still checked live.
      return V.VaultSyncScope.make(claim);
    }
    if (rpc === "RecordConflict") {
      const {
        input: { record },
      } = yield* decode(RecordInput, payload);
      return yield* registered(record.destinationId);
    }
    const isRead = Str.includes(".")(rpc);
    const key = isRead ? (yield* decode(KeyInput, payload)).key : (yield* decode(CommandInput, payload)).target;
    const id = S.is(S.String)(key) ? key : key.id;
    if (Str.startsWith("DestinationList.")(rpc)) {
      const [orgId, workspaceId] = yield* decode(ScopeParts, Str.split(":")(id));
      return V.VaultSyncScope.make({ orgId, workspaceId });
    }
    if (rpc === "ReviewConflict") return yield* conflictScope(id);
    const destinationId = yield* decode(V.DestinationId, id);
    return yield* registered(destinationId);
  }, annotateVaultSyncOutcome);
  const expected = `Bearer ${Redacted.value(binding.token)}`;
  return V.SessionResolver.of({
    resolve: Effect.fn("VaultSyncSession.resolve", traced)(function* (headers) {
      // The transport kind is fixed by the entrypoint; headers can only prove the launch token.
      if (by === "launch-token" && !O.contains(Headers.get(headers, "authorization"), expected)) {
        return yield* V.ScopeDenied.make({});
      }
      // A caller correlation id is kept only when it is a bounded opaque token (D17 F6).
      const supplied = O.filter(Headers.get(headers, "x-correlation-id"), S.is(V.RequestToken));
      const correlationId = O.isSome(supplied) ? supplied.value : yield* mintCorrelationId;
      return V.VaultSyncRequest.make({
        ...binding.request,
        principalKey: V.principalKeyOf(binding.request.principal),
        sourceKind,
        correlationId,
      });
    }, annotateVaultSyncOutcome),
    grants,
    scope,
    revoked: Effect.fn("VaultSyncSession.revoked", traced)(
      (request) =>
        grants(request).pipe(
          Effect.flatMap((current) => (A.isReadonlyArrayEmpty(current) ? V.ScopeDenied.make({}) : pause)),
          Effect.forever
        ),
      annotateVaultSyncOutcome
    ),
  });
});

/**
 * Launch-token adapter for one trusted entrypoint, with live SQL grants.
 *
 * **Details**
 *
 * HTTP, the gated RPC endpoint, the sidecar and MCP each build their own adapter so the
 * transport kind is fixed by the route that accepted the request, never by a header.
 *
 * **Example** (Build the HTTP adapter)
 * ```ts
 * import { layerVaultSyncLaunchTokenResolver } from "@beep/documents-server/aggregates/Sync";
 * const layer = layerVaultSyncLaunchTokenResolver("http");
 * void layer;
 * ```
 * @category layers
 * @since 0.0.0
 */
export const layerVaultSyncLaunchTokenResolver = (sourceKind: V.TransportKind) =>
  Layer.effect(V.SessionResolver, makeResolver(sourceKind, "launch-token"));

/**
 * In-process CLI adapter bound to the local operator, retaining live grant checks.
 *
 * **Details**
 *
 * No credential travels in process; the operator is the bound desktop principal and every
 * call still reads current membership.
 *
 * **Example** (Inspect local adapter)
 * ```ts
 * import { VaultSyncLocalOperatorLive } from "@beep/documents-server/aggregates/Sync";
 * void VaultSyncLocalOperatorLive;
 * ```
 * @category layers
 * @since 0.0.0
 */
export const VaultSyncLocalOperatorLive = Layer.effect(V.SessionResolver, makeResolver("cli", "channel"));

/**
 * Sidecar RPC adapter: the desktop RPC channel is already authenticated by its transport.
 *
 * **Details**
 *
 * HTTP RPC passes the global launch-token middleware and IPC passes the Tauri shell's token
 * check before any handler runs, so this adapter binds the desktop principal without a second
 * header check. Membership is still read live on every call and frame.
 *
 * **Example** (Inspect the sidecar adapter)
 * ```ts
 * import { VaultSyncSidecarChannelLive } from "@beep/documents-server/aggregates/Sync";
 * void VaultSyncSidecarChannelLive;
 * ```
 * @category layers
 * @since 0.0.0
 */
export const VaultSyncSidecarChannelLive = Layer.effect(V.SessionResolver, makeResolver("sidecar", "channel"));

/**
 * Session middleware for one entrypoint: its resolver plus the shared live policy.
 *
 * **Example** (Build the MCP session)
 * ```ts
 * import { layerVaultSyncTransportSession } from "@beep/documents-server/aggregates/Sync";
 * const layer = layerVaultSyncTransportSession("mcp");
 * void layer;
 * ```
 * @category layers
 * @since 0.0.0
 */
export const layerVaultSyncTransportSession = (sourceKind: V.TransportKind) =>
  Layer.provideMerge(VaultSyncSessionLive, layerVaultSyncLaunchTokenResolver(sourceKind));
