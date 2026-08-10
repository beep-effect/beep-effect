/**
 * Constitution outcome axis of the legal position event vocabulary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";

const $I = $LawPracticeDomainId.create("values/ConstitutionOutcome/ConstitutionOutcome.model");

const ConstitutionOutcomeBase = LiteralKit(["constituted", "not-constituted"]);

/**
 * Whether an attempted act was recorded as constituting the legal effect it
 * aimed at.
 *
 * **When to use**
 *
 * Use as one of the two independent recorded axes an attempted act carries. The
 * other is {@link PermissionStatus}.
 *
 * **Details**
 *
 * `constituted` records that the act was determined to bring about its legal
 * effect; `not-constituted` records that it was determined not to, because the
 * actor had no power to do it. A `not-constituted` act still stays on the
 * record as an attempt with no position effect, which is the whole reason the
 * axis exists: an attempt that vanished would leave no trace that anyone tried.
 *
 * **Gotchas**
 *
 * This axis and permission never merge into one field. A single "valid or
 * invalid" outcome collapses two independent legal facts — no power, and no
 * permission — into one, and the collapse silently rewrites a violative act
 * that did change positions into one that never happened.
 *
 * The value is a recorded determination bound to an attributed interpretation,
 * never a computed verdict. In a contested case the system records the
 * determinations and never decides which applies.
 *
 * **Example** (Narrow a recorded constitution outcome)
 *
 * ```ts
 * import { ConstitutionOutcome } from "@beep/law-practice-domain"
 *
 * console.log(ConstitutionOutcome.is["not-constituted"]("not-constituted")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConstitutionOutcome = ConstitutionOutcomeBase.pipe(
  $I.annoteSchema("ConstitutionOutcome", {
    description: "Whether an attempted act was recorded as constituting the legal effect it aimed at.",
  }),
  SchemaUtils.withLiteralKitStatics(ConstitutionOutcomeBase)
);

/**
 * Runtime type for {@link ConstitutionOutcome}.
 *
 * @see {@link ConstitutionOutcome} for the runtime schema and the two-axis rule.
 * @category models
 * @since 0.0.0
 */
export type ConstitutionOutcome = typeof ConstitutionOutcome.Type;
