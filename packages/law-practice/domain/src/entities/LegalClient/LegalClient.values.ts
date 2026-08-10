/**
 * Legal client value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("entities/LegalClient/LegalClient.values");
const LegalClientStatusBase = LiteralKit(["active_client"]);

/**
 * Legal client lifecycle status accepted by the law-practice proof fixtures.
 *
 * **Example** (Decode active client status)
 *
 * ```ts
 * import { LegalClientStatus } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const status = S.decodeUnknownSync(LegalClientStatus)("active_client")
 * console.log(status) // "active_client"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const LegalClientStatus = LegalClientStatusBase.pipe(
  $I.annoteSchema("LegalClientStatus", {
    description: "Legal client lifecycle status accepted by law-practice proof fixtures.",
  }),
  SchemaUtils.withLiteralKitStatics(LegalClientStatusBase),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

/**
 * Type-level literal union produced by {@link LegalClientStatus}.
 *
 * **Example** (Satisfy LegalClientStatus type)
 *
 * ```ts
 * import type { LegalClientStatus } from "@beep/law-practice-domain"
 *
 * const status = "active_client" satisfies LegalClientStatus
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LegalClientStatus = typeof LegalClientStatus.Type;
