/**
 * Rejection value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { LawPracticeFixtureKey, LawPracticeText } from "../LawPracticeEntity.fields.ts";

const $I = $LawPracticeDomainId.create("entities/Rejection/Rejection.values");

const RejectionStatute = LiteralKit(["102", "103", "101", "112"]).annotate(
  $I.annote("RejectionStatute", {
    description: "Patent statute sections supported by law-practice rejection grounds.",
  })
);

/**
 * The statutory ground of a rejection, discriminated on the statute section it
 * is grounded in. The tagged union encodes prior-art cardinality directly in the
 * type: an anticipation rejection (§102) cites exactly one reference; an
 * obviousness rejection (§103) combines one or more references with a stated
 * combination rationale; subject-matter (§101) and written-description /
 * definiteness (§112) rejections cite no prior art.
 *
 * **Example** (Decode §102 anticipation ground)
 *
 * ```ts
 * import { RejectionGround } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const ground = S.decodeUnknownSync(RejectionGround)({
 *   statute: "102",
 *   referenceFixtureKey: "ref.smith",
 * })
 * console.log(ground.statute) // "102"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const RejectionGround = RejectionStatute.toTaggedUnion("statute")({
  "101": {},
  "102": {
    referenceFixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Fixture key for the prior-art reference cited by a §102 rejection.",
    }),
  },
  "103": {
    combinationRationale: LawPracticeText.annotateKey({
      description: "Reason the cited prior-art references are combined for a §103 rejection.",
    }),
    referenceFixtureKeys: S.NonEmptyArray(LawPracticeFixtureKey).annotateKey({
      description: "Fixture keys for the prior-art references combined by a §103 rejection.",
    }),
  },
  "112": {},
}).pipe(
  $I.annoteSchema("RejectionGround", {
    description:
      "Statutory ground of a rejection, encoding prior-art cardinality per statute section (§102 = 1 reference, §103 = >=1 references + rationale, §101/§112 = 0 references).",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type-level tagged union produced by {@link RejectionGround}.
 *
 * **Example** (Satisfy §103 obviousness ground)
 *
 * ```ts
 * import type { RejectionGround } from "@beep/law-practice-domain"
 *
 * const ground = {
 *   combinationRationale: "Smith teaches the hinge and Jones teaches the latch.",
 *   referenceFixtureKeys: ["prior-art.smith", "prior-art.jones"],
 *   statute: "103",
 * } satisfies RejectionGround
 * console.log(ground.statute)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RejectionGround = typeof RejectionGround.Type;
