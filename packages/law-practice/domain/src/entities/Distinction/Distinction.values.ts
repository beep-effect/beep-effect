/**
 * Distinction value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { LawPracticeText } from "../LawPracticeEntity.fields.ts";

const $I = $LawPracticeDomainId.create("entities/Distinction/Distinction.values");

const DistinctionKind = LiteralKit(["missing_limitation"]).annotate(
  $I.annote("DistinctionKind", {
    description: "Distinction detail kinds supported by law-practice proof entities.",
  })
);

const DistinctionDetailDefinition = DistinctionKind.toTaggedUnion("kind")({
  missing_limitation: {
    limitation: LawPracticeText.annotateKey({
      description: "Claim limitation missing from the cited prior art.",
    }),
  },
});

const DistinctionDetailWithCodecStatics = S.make<(typeof DistinctionDetailDefinition)["Rebuild"]>(
  DistinctionDetailDefinition.ast
).pipe(
  $I.annoteSchema("DistinctionDetail", {
    description: "Substantive detail of a distinction, discriminated on its kind.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * The substantive detail of a distinction, discriminated on its kind. The single
 * `missing_limitation` kind names the claim limitation the cited prior art fails
 * to disclose; the tagged union leaves room for further distinction kinds without
 * disturbing existing payloads.
 *
 * **Example** (Decode missing limitation detail)
 *
 * ```ts
 * import { DistinctionDetail } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const detail = S.decodeUnknownSync(DistinctionDetail)({
 *   kind: "missing_limitation",
 *   limitation: "a hinge coupling the lid to the base",
 * })
 * console.log(detail.kind) // "missing_limitation"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const DistinctionDetail = DistinctionDetailWithCodecStatics.pipe(
  S.toTaggedUnion("kind"),
  SchemaUtils.withStatics(() => ({ is: DistinctionDetailWithCodecStatics.is }))
);

/**
 * Type-level tagged union produced by {@link DistinctionDetail}.
 *
 * **Example** (Satisfy missing limitation type)
 *
 * ```ts
 * import type { DistinctionDetail } from "@beep/law-practice-domain"
 *
 * const detail = {
 *   kind: "missing_limitation",
 *   limitation: "a hinge coupling the lid to the base",
 * } satisfies DistinctionDetail
 * console.log(detail.kind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type DistinctionDetail = typeof DistinctionDetail.Type;
