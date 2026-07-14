/**
 * State court rule citation (#636). Mirrors FederalRuleCitation for state-court
 * rules.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.js";
import { FederalRuleComponentSpan } from "../ComponentSpan/index.js";

const $I = $LawPracticeDomainId.create("values/StateRuleCitation/StateRuleCitation.model");

/**
 * State court rule citation (#636).
 *
 * Spreads the shared {@link CitationBase} fields, tags the discriminated union
 * with `type: "stateRule"`, and adds the state-court rule locators. Mirrors the
 * federal-rule citation shape — including reuse of {@link FederalRuleComponentSpan}
 * for the optional `spans` — so state-court rules parse into the same structure.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { StateRuleCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = StateRuleCitation.make({
 *   text: "Fla. R. Civ. P. 1.510",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(10),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "Fla. R. Civ. P. 1.510",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 *   jurisdiction: "FL",
 *   ruleSet: "civil",
 *   rule: "1.510",
 * })
 *
 * console.log(citation.type) // "stateRule"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StateRuleCitation extends S.Class<StateRuleCitation>($I`StateRuleCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("stateRule"),
    jurisdiction: S.String.annotateKey({
      description: '2-letter state code or "CFC" for Court of Federal Claims.',
    }),
    ruleSet: S.Literals(["civil", "criminal", "evidence", "appellate", "bankruptcy", "other"]).annotateKey({
      description: "Rule set classification.",
    }),
    rule: S.String.annotateKey({
      description: "Rule number.",
    }),
    subsection: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Subsection chain (e.g., "(b)(6)").',
      })
    ),
    spans: FederalRuleComponentSpan.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Component spans locating the sub-parts of this citation within the source text.",
      })
    ),
  },
  $I.annote("StateRuleCitation", {
    description: "State court rule citation (#636).",
  })
) {}

/**
 * Companion namespace for `StateRuleCitation`.
 *
 * @example
 * ```ts
 * import type { StateRuleCitation } from "@beep/law-practice-domain"
 *
 * type StateRuleWire = StateRuleCitation.Encoded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace StateRuleCitation {
  /**
   * Wire-encoded representation of a decoded {@link StateRuleCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { StateRuleCitation } from "@beep/law-practice-domain"
   *
   * type Wire = StateRuleCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof StateRuleCitation.Encoded;
}
