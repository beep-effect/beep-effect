/**
 * Production launch-token and local-operator SessionResolver adapters.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { $DocumentsServerId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Headers from "effect/http/Headers";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { VaultSyncMembership } from "./VaultSyncSession.repository.ts";

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
 * Token-authenticated sidecar, HTTP, CLI and configured MCP adapter with live SQL grants.
 *
 * **Example** (Inspect production resolver)
 * ```ts
 * import { VaultSyncSessionResolverLive } from "@beep/documents-server/aggregates/Sync";
 * void VaultSyncSessionResolverLive;
 * ```
 * @category layers
 * @since 0.0.0
 */
export const VaultSyncSessionResolverLive = Layer.effect(
  V.SessionResolver,
  Effect.gen(function* () {
    const binding = yield* VaultSyncSessionBinding;
    const memberships = yield* VaultSyncMembership;
    const destinations = yield* V.SyncDestination;
    const conflicts = yield* V.SyncConflict;
    const grants = Effect.fn("VaultSyncSession.grants")(function* (request: V.VaultSyncRequest) {
      if (request.principal.kind !== "User") return yield* V.ScopeDenied.make({});
      return yield* memberships.read(request.principal.userId, V.VaultSyncScope.make(request));
    });
    const scope = Effect.fn("VaultSyncSession.scope")(function* (rpc: string, payload: unknown) {
      if (rpc === "ClaimDestinationName") {
        const {
          input: { claim },
        } = yield* decode(NameInput, payload);
        // Registration has no existing destination; the workspace owner is still checked live.
        return V.VaultSyncScope.make(claim);
      }
      if (rpc === "RecordConflict") {
        const {
          input: { record },
        } = yield* decode(RecordInput, payload);
        const state = yield* destinations.state(record.destinationId);
        if (state._tag !== "Registered") return yield* V.ScopeDenied.make({});
        return V.VaultSyncScope.make(state);
      }
      const isRead = Str.includes(".")(rpc);
      const key = isRead ? (yield* decode(KeyInput, payload)).key : (yield* decode(CommandInput, payload)).target;
      const id = S.is(S.String)(key) ? key : key.id;
      if (Str.startsWith("DestinationList.")(rpc)) {
        const [orgId, workspaceId] = yield* decode(ScopeParts, Str.split(":")(id));
        return V.VaultSyncScope.make({ orgId, workspaceId });
      }
      if (rpc === "ReviewConflict") {
        const conflictId = yield* decode(V.ConflictId, id);
        const conflict = yield* conflicts.state(conflictId);
        if (conflict === null) return yield* V.ScopeDenied.make({});
        const state = yield* destinations.state(conflict.destinationId);
        if (state._tag !== "Registered" || state.workspaceId !== conflict.workspaceId)
          return yield* V.ScopeDenied.make({});
        return V.VaultSyncScope.make(state);
      }
      const destinationId = yield* decode(V.DestinationId, id);
      const state = yield* destinations.state(destinationId);
      if (state._tag !== "Registered") return yield* V.ScopeDenied.make({});
      return V.VaultSyncScope.make(state);
    });
    return V.SessionResolver.of({
      resolve: Effect.fn("VaultSyncSession.resolve")(function* (headers) {
        if (!O.contains(`Bearer ${Redacted.value(binding.token)}`)(Headers.get(headers, "authorization"))) {
          return yield* V.ScopeDenied.make({});
        }
        const at = yield* Clock.currentTimeMillis;
        return V.VaultSyncRequest.make({
          ...binding.request,
          correlationId: O.getOrElse(
            Headers.get(headers, "x-correlation-id"),
            () => `${binding.request.sessionRef}:${at}`
          ),
        });
      }),
      grants,
      scope,
      revoked: Effect.fn("VaultSyncSession.revoked")((request) =>
        grants(request).pipe(
          Effect.flatMap((current) =>
            A.isReadonlyArrayEmpty(current) ? V.ScopeDenied.make({}) : Effect.sleep("50 millis")
          ),
          Effect.forever
        )
      ),
    });
  })
);

/**
 * In-process CLI adapter bound to the enrolled local operator, retaining live grant checks.
 *
 * **Example** (Inspect local adapter)
 * ```ts
 * import { VaultSyncLocalOperatorLive } from "@beep/documents-server/aggregates/Sync";
 * void VaultSyncLocalOperatorLive;
 * ```
 * @category layers
 * @since 0.0.0
 */
export const VaultSyncLocalOperatorLive = Layer.effect(
  V.SessionResolver,
  Effect.gen(function* () {
    const remote = yield* V.SessionResolver;
    const binding = yield* VaultSyncSessionBinding;
    return V.SessionResolver.of({
      ...remote,
      resolve: Effect.fn("VaultSyncSession.localOperator")(() =>
        Effect.succeed(V.VaultSyncRequest.make({ ...binding.request, sourceKind: "cli" }))
      ),
    });
  })
);
