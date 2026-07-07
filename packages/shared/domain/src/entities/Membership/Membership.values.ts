/**
 * Shared-kernel Membership value vocabulary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $SharedDomainId.create("entities/Membership/Membership.values");
const RoleBase = LiteralKit(["owner", "member"]);
const StatusBase = LiteralKit(["active"]);

/**
 * Organization membership role.
 *
 * @example
 * ```ts
 * import { Role } from "@beep/shared-domain/entities/Membership"
 *
 * console.log(Role.is.owner("owner"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Role = RoleBase.pipe(
  $I.annoteSchema("Role", {
    description: "Shared organization membership role.",
  }),
  SchemaUtils.withLiteralKitStatics(RoleBase),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

/**
 * Runtime type for {@link Role}.
 *
 * @example
 * ```ts
 * import type { Role } from "@beep/shared-domain/entities/Membership"
 *
 * const role: Role = "owner"
 * console.log(role)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Role = typeof Role.Type;

/**
 * Organization membership lifecycle status.
 *
 * @example
 * ```ts
 * import { Status } from "@beep/shared-domain/entities/Membership"
 *
 * console.log(Status.is.active("active"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Status = StatusBase.pipe(
  $I.annoteSchema("Status", {
    description: "Shared organization membership lifecycle status.",
  }),
  SchemaUtils.withLiteralKitStatics(StatusBase),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

/**
 * Runtime type for {@link Status}.
 *
 * @example
 * ```ts
 * import type { Status } from "@beep/shared-domain/entities/Membership"
 *
 * const status: Status = "active"
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Status = typeof Status.Type;
