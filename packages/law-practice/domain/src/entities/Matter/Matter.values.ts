/**
 * Matter value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("entities/Matter/Matter.values");
const MatterTypeBase = LiteralKit(["patent_application"]);

/**
 * Matter type accepted by the law-practice proof fixtures.
 *
 * **Example** (Decode MatterType with Schema)
 *
 * ```ts
 * import { MatterType } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const matterType = S.decodeUnknownSync(MatterType)("patent_application")
 * console.log(matterType) // "patent_application"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const MatterType = MatterTypeBase.pipe(
  $I.annoteSchema("MatterType", {
    description: "Matter type accepted by law-practice proof fixtures.",
  }),
  SchemaUtils.withLiteralKitStatics(MatterTypeBase),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

/**
 * Type-level literal union produced by {@link MatterType}.
 *
 * **Example** (Satisfy MatterType literal type)
 *
 * ```ts
 * import type { MatterType } from "@beep/law-practice-domain"
 *
 * const matterType = "patent_application" satisfies MatterType
 * console.log(matterType)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type MatterType = typeof MatterType.Type;
