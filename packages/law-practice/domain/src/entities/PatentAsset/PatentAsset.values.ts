/**
 * Patent asset value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("entities/PatentAsset/PatentAsset.values");
const PatentAssetStatusBase = LiteralKit(["pre_filing"]);

/**
 * Patent asset lifecycle status accepted by the law-practice proof fixtures.
 *
 * @example
 * ```ts
 * import { PatentAssetStatus } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const status = S.decodeUnknownSync(PatentAssetStatus)("pre_filing")
 * console.log(status) // "pre_filing"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const PatentAssetStatus = PatentAssetStatusBase.pipe(
  $I.annoteSchema("PatentAssetStatus", {
    description: "Patent asset lifecycle status accepted by law-practice proof fixtures.",
  }),
  SchemaUtils.withLiteralKitStatics(PatentAssetStatusBase),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

/**
 * Type-level literal union produced by {@link PatentAssetStatus}.
 *
 * @example
 * ```ts
 * import type { PatentAssetStatus } from "@beep/law-practice-domain"
 *
 * const status = "pre_filing" satisfies PatentAssetStatus
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PatentAssetStatus = typeof PatentAssetStatus.Type;
