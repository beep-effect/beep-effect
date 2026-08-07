/**
 * The four legal verdict families an attorney may assign to a candidate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";

const $I = $LawPracticeDomainId.create("values/LegalVerdictFamily/LegalVerdictFamily.model");

const LegalVerdictFamilyBase = LiteralKit([
  "rule-conflict",
  "principle-collision",
  "interpretation-dispute",
  "factual-dispute",
]);

/**
 * What kind of disagreement an attorney has assigned a candidate pair to.
 *
 * **When to use**
 *
 * Use with law-side records that carry an attorney's assignment. The vocabulary
 * is law-practice language and belongs only to records this slice owns.
 *
 * **Details**
 *
 * `rule-conflict` records two rules that cannot both be applied;
 * `principle-collision` records two principles that both apply and pull
 * opposite ways, which is the ordinary consequence of one party holding several
 * roles; `interpretation-dispute` records one source read two ways; and
 * `factual-dispute` records agreement on the law with disagreement about what
 * happened. The four are not ranked and nothing orders them.
 *
 * **Gotchas**
 *
 * A family is assigned by a person, never derived. Nothing in this package
 * infers which family a candidate belongs to, and a candidate with no
 * assignment is unassigned rather than defaulted into one.
 *
 * The generic contradiction vocabulary this slice composes stays closed and
 * untouched. These four members never merge into it, and no single enum spans
 * both.
 *
 * **Example** (Narrow an assigned verdict family)
 *
 * ```ts
 * import { LegalVerdictFamily } from "@beep/law-practice-domain"
 *
 * console.log(LegalVerdictFamily.is["principle-collision"]("principle-collision")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LegalVerdictFamily = LegalVerdictFamilyBase.pipe(
  $I.annoteSchema("LegalVerdictFamily", {
    description: "The four attorney-assigned legal verdict families carried on law-side candidate records.",
  }),
  SchemaUtils.withLiteralKitStatics(LegalVerdictFamilyBase)
);

/**
 * Runtime type for {@link LegalVerdictFamily}.
 *
 * @see {@link LegalVerdictFamily} for the runtime schema and the never-derived rule.
 * @category models
 * @since 0.0.0
 */
export type LegalVerdictFamily = typeof LegalVerdictFamily.Type;
