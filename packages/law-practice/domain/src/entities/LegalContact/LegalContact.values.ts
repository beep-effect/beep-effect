/**
 * Legal contact value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("entities/LegalContact/LegalContact.values");
const LegalContactRoleBase = LiteralKit(["founder"]);

/**
 * Legal contact role accepted by the law-practice proof fixtures.
 *
 * **Example** (Decode founder role value)
 *
 * ```ts
 * import { LegalContactRole } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const role = S.decodeUnknownSync(LegalContactRole)("founder")
 * console.log(role) // "founder"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const LegalContactRole = LegalContactRoleBase.pipe(
  $I.annoteSchema("LegalContactRole", {
    description: "Legal contact role accepted by law-practice proof fixtures.",
  }),
  SchemaUtils.withLiteralKitStatics(LegalContactRoleBase),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

/**
 * Type-level literal union produced by {@link LegalContactRole}.
 *
 * **Example** (Satisfy founder role type)
 *
 * ```ts
 * import type { LegalContactRole } from "@beep/law-practice-domain"
 *
 * const role = "founder" satisfies LegalContactRole
 * console.log(role)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LegalContactRole = typeof LegalContactRole.Type;
