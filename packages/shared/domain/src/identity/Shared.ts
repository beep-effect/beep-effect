/**
 * Shared-kernel entity-id registry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity/packages";
import * as EntityId from "../entity/EntityId.ts";

const $I = $SharedDomainId.create("identity/Shared");
const make = EntityId.factory("shared", $I);

/**
 * Organization entity identifier.
 *
 * @example
 * ```ts
 * import { OrganizationId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(OrganizationId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const OrganizationId = make("organization", {
  description: "Identifier for a shared-kernel organization entity.",
});

/**
 * Companion type for {@link OrganizationId.Type}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { OrganizationId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(OrganizationId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type OrganizationId = typeof OrganizationId.Type;

/**
 * User entity identifier.
 *
 * @example
 * ```ts
 * import { UserId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(UserId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const UserId = make("user", {
  description: "Identifier for a shared-kernel user entity.",
});

/**
 * Companion type for {@link UserId.Type}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { UserId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(UserId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type UserId = typeof UserId.Type;

/**
 * Membership entity identifier.
 *
 * @example
 * ```ts
 * import { MembershipId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(MembershipId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const MembershipId = make("membership", {
  description: "Identifier for a shared-kernel membership entity.",
});

/**
 * Companion type for {@link MembershipId.Type}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { MembershipId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(MembershipId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type MembershipId = typeof MembershipId.Type;

/**
 * Team entity identifier.
 *
 * @example
 * ```ts
 * import { TeamId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(TeamId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const TeamId = make("team", {
  description: "Identifier for a shared-kernel team entity.",
});

/**
 * Companion type for {@link TeamId.Type}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { TeamId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(TeamId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type TeamId = typeof TeamId.Type;

/**
 * Service-account entity identifier.
 *
 * @example
 * ```ts
 * import { ServiceAccountId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(ServiceAccountId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ServiceAccountId = make("service_account", {
  description: "Identifier for a shared-kernel service account entity.",
});

/**
 * Companion type for {@link ServiceAccountId.Type}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { ServiceAccountId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(ServiceAccountId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ServiceAccountId = typeof ServiceAccountId.Type;

/**
 * Agent entity identifier.
 *
 * @example
 * ```ts
 * import { AgentId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(AgentId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const AgentId = make("agent", {
  description: "Identifier for a shared-kernel agent entity.",
});

/**
 * Companion type for {@link AgentId.Type}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AgentId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(AgentId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type AgentId = typeof AgentId.Type;

/**
 * Agent-version entity identifier.
 *
 * @example
 * ```ts
 * import { AgentVersionId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(AgentVersionId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const AgentVersionId = make("agent_version", {
  description: "Identifier for a shared-kernel agent version entity.",
});

/**
 * Companion type for {@link AgentVersionId.Type}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AgentVersionId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(AgentVersionId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type AgentVersionId = typeof AgentVersionId.Type;

/**
 * Connector-account entity identifier.
 *
 * @example
 * ```ts
 * import { ConnectorAccountId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(ConnectorAccountId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ConnectorAccountId = make("connector_account", {
  description: "Identifier for a shared-kernel connector account entity.",
});

/**
 * Companion type for {@link ConnectorAccountId.Type}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { ConnectorAccountId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(ConnectorAccountId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ConnectorAccountId = typeof ConnectorAccountId.Type;

/**
 * Activity entity identifier used by provenance and lifecycle entity fields.
 *
 * @example
 * ```ts
 * import { ActivityId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(ActivityId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ActivityId = make("activity", {
  description: "Identifier for a shared-kernel provenance activity entity.",
});

/**
 * Companion type for {@link ActivityId.Type}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { ActivityId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(ActivityId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ActivityId = typeof ActivityId.Type;

/**
 * Local-machine entity identifier used by synchronization metadata.
 *
 * @example
 * ```ts
 * import { LocalMachineId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(LocalMachineId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const LocalMachineId = make("local_machine", {
  description: "Identifier for a local machine participating in sync.",
});

/**
 * Companion type for {@link LocalMachineId.Type}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { LocalMachineId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(LocalMachineId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type LocalMachineId = typeof LocalMachineId.Type;
