/**
 * Permission status axis of the legal position event vocabulary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";

const $I = $LawPracticeDomainId.create("values/PermissionStatus/PermissionStatus.model");

const PermissionStatusBase = LiteralKit(["permitted", "violative"]);

/**
 * Whether an act was recorded as permitted or as violating a duty.
 *
 * **When to use**
 *
 * Use as one of the two independent recorded axes an attempted act carries. The
 * other is {@link ConstitutionOutcome}.
 *
 * **Details**
 *
 * `permitted` records that the act was determined to breach nothing;
 * `violative` records that it was determined to breach a duty. A violative act
 * may still be fully effective: an act done without permission but within power
 * changes positions **and** records the violation. Both facts stand together,
 * and neither is derived from the other.
 *
 * **Gotchas**
 *
 * This axis and constitution never merge into one field. Treating every
 * violation as also voiding the act is the uniform-violation rule this
 * vocabulary deliberately does not adopt: it erases the ordinary case of an
 * effective breach, which is most of what a practice actually records.
 *
 * The value is a recorded determination bound to an attributed interpretation.
 * That a violation was asserted is never a finding that one legally occurred,
 * and no consequence follows from it here.
 *
 * **Example** (Narrow a recorded permission status)
 *
 * ```ts
 * import { PermissionStatus } from "@beep/law-practice-domain"
 *
 * console.log(PermissionStatus.is.violative("violative")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PermissionStatus = PermissionStatusBase.pipe(
  $I.annoteSchema("PermissionStatus", {
    description: "Whether an act was recorded as permitted or as violating a duty.",
  }),
  SchemaUtils.withLiteralKitStatics(PermissionStatusBase)
);

/**
 * Runtime type for {@link PermissionStatus}.
 *
 * @see {@link PermissionStatus} for the runtime schema and the two-axis rule.
 * @category models
 * @since 0.0.0
 */
export type PermissionStatus = typeof PermissionStatus.Type;
