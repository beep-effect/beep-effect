/**
 * Shared live authorization for every vault-sync transport.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DocumentsDomainId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as RpcMiddleware from "effect/rpc/RpcMiddleware";
import * as Str from "effect/String";
import { ScopeDenied, SessionResolver, VaultSyncRequestContext } from "./Session.context.ts";

const $I = $DocumentsDomainId.create("aggregates/VaultSync/Session.middleware");
/**
 * Session is mandatory on each externally exposed command and View RPC.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { Session } from "@beep/documents-domain/aggregates/VaultSync";
 * void Session;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class Session extends RpcMiddleware.Service<Session>()($I`Session`, { error: ScopeDenied }) {}
/**
 * Check live grants against authoritative ownership; captured context is identity only.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { authorizeVaultSync } from "@beep/documents-domain/aggregates/VaultSync";
 * void authorizeVaultSync;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const authorizeVaultSync = Effect.fn("VaultSync.authorize")(function* (rpc: string, payload: unknown) {
  const request = yield* Effect.serviceOption(VaultSyncRequestContext);
  const resolver = yield* Effect.serviceOption(SessionResolver);
  if (O.isNone(request) || O.isNone(resolver)) return yield* ScopeDenied.make({});
  const scope = yield* resolver.value.scope(rpc, payload);
  if (scope.orgId !== request.value.orgId || scope.workspaceId !== request.value.workspaceId) {
    return yield* ScopeDenied.make({});
  }
  const grants = yield* resolver.value.grants(request.value);
  const diagnostic = Str.startsWith("OperationQueue.")(rpc);
  if (
    !A.some(
      grants,
      (grant) =>
        grant.orgId === scope.orgId && grant.workspaceId === scope.workspaceId && (!diagnostic || grant.diagnostic)
    )
  )
    return yield* ScopeDenied.make({});
});
