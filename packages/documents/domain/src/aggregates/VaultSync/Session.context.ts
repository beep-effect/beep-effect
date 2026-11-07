/**
 * Serializable request identity and live authorization contracts.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import { $DocumentsDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Principal } from "@beep/shared-domain/entity/Principal";
import { SourceKind } from "@beep/shared-domain/entity/SourceKind";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import { RequestToken } from "./Values.ts";
import type * as Effect from "effect/Effect";
import type * as Headers from "effect/http/Headers";

const $I = $DocumentsDomainId.create("aggregates/VaultSync/Session.context");
/**
 * Trusted entrypoint provenance, separate from the actor category.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { TransportKind } from "@beep/documents-domain/aggregates/VaultSync";
 * void TransportKind;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const TransportKind = LiteralKit(["http", "cli", "mcp", "sidecar"]).pipe(
  $I.annoteSchema("TransportKind", { description: "Verified vault-sync transport." })
);
/**
 * Transport provenance value.
 * @category aggregates
 * @since 0.0.0
 */
export type TransportKind = typeof TransportKind.Type;
/**
 * Flat string form of a principal: its kind and its own id, such as `User:1`.
 *
 * **Details**
 *
 * The Postgres driver copies only string context fields into its `principal`
 * provenance column, so the request context carries this key beside the
 * structured principal (D17 F8). Build it with {@link principalKeyOf}.
 *
 * **Example** (Validate a principal key)
 * ```ts
 * import { PrincipalKey } from "@beep/documents-domain/aggregates/VaultSync";
 * import * as S from "effect/Schema";
 * console.log(S.is(PrincipalKey)("User:1")); // true
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const PrincipalKey = S.String.check(
  S.isPattern(/^(User|ServiceAccount|Agent|ConnectorAccount|System):[A-Za-z0-9_-]{1,64}$/)
).pipe($I.annoteSchema("PrincipalKey", { description: "Principal kind and id as one provenance string." }));
/**
 * Runtime value accepted by {@link PrincipalKey}.
 *
 * @category aggregates
 * @since 0.0.0
 */
export type PrincipalKey = typeof PrincipalKey.Type;
/**
 * Derive the provenance key of a principal.
 *
 * **Example** (Key a user principal)
 * ```ts
 * import { principalKeyOf } from "@beep/documents-domain/aggregates/VaultSync";
 * import { Principal } from "@beep/shared-domain/entity/Principal";
 * import * as S from "effect/Schema";
 * const principal = S.decodeUnknownSync(Principal)({ kind: "User", userId: 1 });
 * console.log(principalKeyOf(principal)); // "User:1"
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const principalKeyOf = (principal: Principal): PrincipalKey =>
  `${principal.kind}:${Principal.match(principal, {
    User: (p) => `${p.userId}`,
    ServiceAccount: (p) => `${p.serviceAccountId}`,
    Agent: (p) => `${p.agentVersionId}`,
    ConnectorAccount: (p) => `${p.connectorAccountId}`,
    System: (p) => p.component,
  })}`;
/**
 * Persisted identity and requested scope; this value contains no grant or credential.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { VaultSyncRequest } from "@beep/documents-domain/aggregates/VaultSync";
 * void VaultSyncRequest;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class VaultSyncRequest extends S.Opaque<VaultSyncRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    principal: Principal,
    sourceKind: TransportKind,
    actorSourceKind: SourceKind,
    orgId: S.Int,
    workspaceId: S.Int,
    principalKey: PrincipalKey,
    correlationId: RequestToken,
    sessionRef: S.NonEmptyString,
  }).pipe($I.annoteSchema("VaultSyncRequest", { description: "Non-secret v1 initiating request context." }))
) {}
/**
 * Registered alchemy request context captured into SendMeta.context.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { VaultSyncRequestContext } from "@beep/documents-domain/aggregates/VaultSync";
 * void VaultSyncRequestContext;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class VaultSyncRequestContext extends Domain.RequestContext<VaultSyncRequestContext>()(
  "documents/vault-sync/RequestContext/v1",
  VaultSyncRequest
) {}
/**
 * Uniform denial concealing resource existence and tenant ownership.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ScopeDenied } from "@beep/documents-domain/aggregates/VaultSync";
 * void ScopeDenied;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ScopeDenied extends S.TaggedError<ScopeDenied, { readonly brand: unique symbol }>()(
  "ScopeDenied",
  {},
  $I.annote("ScopeDenied", { description: "Vault-sync access denied.", httpApiStatus: 403 })
) {}
/**
 * Authoritative resource ownership resolved independently of public key spelling.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { VaultSyncScope } from "@beep/documents-domain/aggregates/VaultSync";
 * void VaultSyncScope;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class VaultSyncScope extends S.Opaque<VaultSyncScope, { readonly brand: unique symbol }>()(
  S.Struct({ orgId: S.Int, workspaceId: S.Int }).pipe(
    $I.annoteSchema("VaultSyncScope", { description: "Authoritative organization and workspace binding." })
  )
) {}
/**
 * Current membership and diagnostics grant returned by the identity owner.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { VaultSyncGrant } from "@beep/documents-domain/aggregates/VaultSync";
 * void VaultSyncGrant;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class VaultSyncGrant extends S.Opaque<VaultSyncGrant, { readonly brand: unique symbol }>()(
  S.Struct({ orgId: S.Int, workspaceId: S.Int, diagnostic: S.Boolean }).pipe(
    $I.annoteSchema("VaultSyncGrant", { description: "One active live workspace grant." })
  )
) {}
/**
 * Host-owned credential verification, current membership lookup and authoritative resource routing.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { SessionResolver } from "@beep/documents-domain/aggregates/VaultSync";
 * void SessionResolver;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class SessionResolver extends Context.Service<
  SessionResolver,
  {
    readonly resolve: (headers: Headers.Headers) => Effect.Effect<VaultSyncRequest, ScopeDenied>;
    readonly grants: (request: VaultSyncRequest) => Effect.Effect<ReadonlyArray<VaultSyncGrant>, ScopeDenied>;
    readonly scope: (rpc: string, payload: unknown) => Effect.Effect<VaultSyncScope, ScopeDenied>;
    readonly revoked: (request: VaultSyncRequest) => Effect.Effect<never, ScopeDenied>;
  }
>()($I`SessionResolver`) {}
