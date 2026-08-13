/**
 * Canonical actor reference schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import * as Shared from "../identity/Shared/index.ts";

const $I = $SharedDomainId.create("entity/Principal");
const SystemComponentBase = LiteralKit(["Runtime", "Sync", "Migration", "Policy", "Generator"]);

/**
 * Shared system components that can author persisted rows.
 *
 * **Example** (Check Runtime component)
 *
 * ```ts
 * import { SystemComponent } from "@beep/shared-domain/entity/Principal"
 *
 * console.log(SystemComponent.is.Runtime("Runtime"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SystemComponent = SystemComponentBase.pipe(
  $I.annoteSchema("SystemComponent", {
    description: "System component allowed to appear in a system principal.",
  }),
  SchemaUtils.withLiteralKitStatics(SystemComponentBase),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

/**
 * Runtime type for {@link SystemComponent}.
 *
 * **Example** (Type a system component)
 *
 * ```ts
 * import type { SystemComponent } from "@beep/shared-domain/entity/Principal"
 *
 * const component: SystemComponent = "Runtime"
 * console.log(component)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SystemComponent = typeof SystemComponent.Type;

/**
 * Principal variant for a user actor.
 *
 * **Example** (Decode user principal)
 *
 * ```ts
 * import { UserPrincipal } from "@beep/shared-domain/entity/Principal"
 * import * as S from "effect/Schema"
 *
 * const principal = S.decodeUnknownSync(UserPrincipal)({
 *   kind: "User",
 *   userId: 1
 * })
 *
 * console.log(principal.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UserPrincipal extends S.Class<UserPrincipal>($I`UserPrincipal`)(
  {
    kind: S.tag("User").annotateKey({ description: "Principal discriminator for a user actor." }),
    userId: Shared.UserId.annotateKey({ description: "Shared user id for the actor." }),
  },
  $I.annote("UserPrincipal", {
    description: "Canonical actor reference for a user.",
  })
) {}

/**
 * Principal variant for a service account.
 *
 * **Example** (Decode service account principal)
 *
 * ```ts
 * import { ServiceAccountPrincipal } from "@beep/shared-domain/entity/Principal"
 * import * as S from "effect/Schema"
 *
 * const principal = S.decodeUnknownSync(ServiceAccountPrincipal)({
 *   kind: "ServiceAccount",
 *   serviceAccountId: 1
 * })
 *
 * console.log(principal.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ServiceAccountPrincipal extends S.Class<ServiceAccountPrincipal>($I`ServiceAccountPrincipal`)(
  {
    kind: S.tag("ServiceAccount").annotateKey({
      description: "Principal discriminator for a service-account actor.",
    }),
    onBehalfOfUserId: S.OptionFromOptionalKey(Shared.UserId).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional user id represented by the service account." })
    ),
    serviceAccountId: Shared.ServiceAccountId.annotateKey({
      description: "Shared service-account id for the actor.",
    }),
  },
  $I.annote("ServiceAccountPrincipal", {
    description: "Canonical actor reference for a service account.",
  })
) {}

/**
 * Principal variant for an AI agent acting in the system.
 *
 * **Example** (Decode agent principal)
 *
 * ```ts
 * import { AgentPrincipal } from "@beep/shared-domain/entity/Principal"
 * import * as S from "effect/Schema"
 *
 * const principal = S.decodeUnknownSync(AgentPrincipal)({
 *   agentId: 1,
 *   agentVersionId: 2,
 *   kind: "Agent",
 *   onBehalfOfUserId: 3
 * })
 *
 * console.log(principal.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentPrincipal extends S.Class<AgentPrincipal>($I`AgentPrincipal`)(
  {
    agentId: Shared.AgentId.annotateKey({ description: "Shared agent id for the actor." }),
    agentVersionId: Shared.AgentVersionId.annotateKey({
      description: "Shared agent-version id for the actor.",
    }),
    kind: S.tag("Agent").annotateKey({ description: "Principal discriminator for an AI-agent actor." }),
    onBehalfOfTeamId: S.OptionFromOptionalKey(Shared.TeamId).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional team id represented by the agent." })
    ),
    onBehalfOfUserId: Shared.UserId.annotateKey({ description: "User id represented by the agent." }),
  },
  $I.annote("AgentPrincipal", {
    description: "Canonical actor reference for an agent.",
  })
) {}

/**
 * Principal variant for a connector account.
 *
 * **Example** (Decode connector account principal)
 *
 * ```ts
 * import { ConnectorAccountPrincipal } from "@beep/shared-domain/entity/Principal"
 * import * as S from "effect/Schema"
 *
 * const principal = S.decodeUnknownSync(ConnectorAccountPrincipal)({
 *   connectorAccountId: 1,
 *   kind: "ConnectorAccount"
 * })
 *
 * console.log(principal.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConnectorAccountPrincipal extends S.Class<ConnectorAccountPrincipal>($I`ConnectorAccountPrincipal`)(
  {
    connectorAccountId: Shared.ConnectorAccountId.annotateKey({
      description: "Shared connector-account id for the actor.",
    }),
    kind: S.tag("ConnectorAccount").annotateKey({
      description: "Principal discriminator for a connector-account actor.",
    }),
    onBehalfOfUserId: S.OptionFromOptionalKey(Shared.UserId).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional user id represented by the connector account." })
    ),
  },
  $I.annote("ConnectorAccountPrincipal", {
    description: "Canonical actor reference for a connector account.",
  })
) {}

/**
 * Principal variant for internal system work.
 *
 * **Example** (Create system principal)
 *
 * ```ts
 * import { SystemPrincipal } from "@beep/shared-domain/entity/Principal"
 *
 * const principal = SystemPrincipal.make({
 *   kind: "System",
 *   component: "Runtime",
 * })
 * console.log(principal.component)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SystemPrincipal extends S.Class<SystemPrincipal>($I`SystemPrincipal`)(
  {
    component: SystemComponent.annotateKey({ description: "System component responsible for the action." }),
    kind: S.tag("System").annotateKey({ description: "Principal discriminator for internal system work." }),
  },
  $I.annote("SystemPrincipal", {
    description: "Canonical actor reference for a system component.",
  })
) {}

const PrincipalBase = S.Union([
  UserPrincipal,
  ServiceAccountPrincipal,
  AgentPrincipal,
  ConnectorAccountPrincipal,
  SystemPrincipal,
]).pipe(
  $I.annoteSchema("Principal", {
    description: "Principal actor reference used by shared-kernel persisted entity fields.",
  }),
  S.toTaggedUnion("kind"),
  SchemaUtils.withCodecStatics
);

type PrincipalSchemaBase = typeof PrincipalBase;

/**
 * Named schema surface for {@link Principal}.
 *
 * Declaration emit references this interface by name instead of serializing
 * the derived tagged-union schema structurally at every consumer position.
 *
 * @category schemas
 * @since 0.0.0
 */
export interface PrincipalSchema extends PrincipalSchemaBase {}

/**
 * Tagged union used by every BaseEntity field that names an actor.
 *
 * **Example** (Decode system principal)
 *
 * ```ts
 * import { Principal } from "@beep/shared-domain/entity/Principal"
 * import * as S from "effect/Schema"
 *
 * const principal = S.decodeUnknownSync(Principal)({
 *   kind: "System",
 *   component: "Runtime"
 * })
 *
 * console.log(principal.kind) // "System"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Principal: PrincipalSchema = PrincipalBase;

/**
 * Runtime type for {@link Principal}.
 *
 * **Example** (Annotate principal value)
 *
 * ```ts
 * import type { Principal } from "@beep/shared-domain/entity/Principal"
 *
 * const principal: Principal = {
 *   kind: "System",
 *   component: "Runtime",
 * }
 * console.log(principal.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Principal = typeof Principal.Type;

/**
 * Encoded boundary type for {@link Principal}.
 *
 * **Example** (Annotate encoded principal)
 *
 * ```ts
 * import type { Principal } from "@beep/shared-domain/entity/Principal"
 *
 * const encoded: Principal.Encoded = {
 *   kind: "System",
 *   component: "Runtime",
 * }
 * console.log(encoded.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Principal {
  /**
   * Encoded boundary companion type for {@link Principal}.
   *
   * **Example** (Use encoded principal type)
   *
   * ```ts
   * import type { Principal } from "@beep/shared-domain/entity/Principal"
   *
   * const encoded: Principal.Encoded = {
   *   kind: "System",
   *   component: "Runtime",
   * }
   * console.log(encoded)
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof Principal.Encoded;
}
