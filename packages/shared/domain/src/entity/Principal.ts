/**
 * Canonical actor reference schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import * as Shared from "../identity/Shared.ts";

const $I = $SharedDomainId.create("entity/Principal");
const SystemComponentBase = LiteralKit(["Runtime", "Sync", "Migration", "Policy", "Generator"]);

/**
 * Shared system components that can author persisted rows.
 *
 * @example
 * ```ts
 * import { SystemComponent } from "@beep/shared-domain/entity/Principal"
 *
 * console.log(SystemComponent.is.Runtime("Runtime"))
 * ```
 *
 * @since 0.0.0
 * @category schemas
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
 * @example
 * ```ts
 * import type { SystemComponent } from "@beep/shared-domain/entity/Principal"
 *
 * const component: SystemComponent = "Runtime"
 * console.log(component)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type SystemComponent = typeof SystemComponent.Type;

/**
 * Principal variant for a user actor.
 *
 * @example
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
 * @example
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
 * @example
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
 * @example
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
 * @example
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
 * @since 0.0.0
 * @category models
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

/**
 * Tagged union used by every BaseEntity field that names an actor.
 *
 * @example
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
export const Principal = S.Union([
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

/**
 * Runtime type for {@link Principal}.
 *
 * @example
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
 * @since 0.0.0
 * @category models
 */
export type Principal = typeof Principal.Type;

/**
 * Encoded boundary type for {@link Principal}.
 *
 * @example
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
 * @since 0.0.0
 * @category models
 */
export declare namespace Principal {
  /**
   * Encoded boundary companion type for {@link Principal}.
   *
   * @example
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
