/**
 * Federal Rules of Procedure citation, covering the civil, criminal, evidence,
 * appellate, and bankruptcy rule sets (#576).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.js";
import { FederalRuleComponentSpan } from "../ComponentSpan/index.js";

const $I = $LawPracticeDomainId.create("values/FederalRuleCitation/FederalRuleCitation.model");

/**
 * Federal Rules of Procedure citation (type: `federalRule`, #576).
 *
 * Spreads the shared {@link CitationBase} fields and adds a `federalRule`
 * discriminant tag plus the parsed rule set, rule number, optional subsection
 * chain, and optional component spans. `rule` is a string so leading zeros and
 * non-numeric suffixes are preserved.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { FederalRuleCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = FederalRuleCitation.make({
 *   text: "Fed. R. Civ. P. 12",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(10),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "Fed. R. Civ. P. 12",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 *   ruleSet: "civil",
 *   rule: "12",
 * })
 *
 * console.log(citation.type) // "federalRule"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FederalRuleCitation extends S.Class<FederalRuleCitation>($I`FederalRuleCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("federalRule"),
    ruleSet: S.Literals(["civil", "criminal", "evidence", "appellate", "bankruptcy"]).annotateKey({
      description: "Which rule set the citation refers to.",
    }),
    rule: S.String.annotateKey({
      description: "Rule number (string to preserve leading zeros / non-numeric suffixes).",
    }),
    subsection: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Subsection chain (e.g., "(b)(6)") — undefined when not cited.',
      })
    ),
    spans: FederalRuleComponentSpan.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Component spans locating each recognized sub-part of the citation within the source text.",
      })
    ),
  },
  $I.annote("FederalRuleCitation", {
    description:
      "Federal Rules of Procedure citation covering the civil, criminal, evidence, appellate, and bankruptcy rule sets (#576).",
  })
) {}

/**
 * Companion namespace for `FederalRuleCitation`.
 *
 * @example
 * ```ts
 * import type { FederalRuleCitation } from "@beep/law-practice-domain"
 *
 * const type: FederalRuleCitation.Encoded["type"] = "federalRule"
 * console.log(type) // "federalRule"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace FederalRuleCitation {
  /**
   * Wire-encoded representation of a decoded {@link FederalRuleCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { FederalRuleCitation } from "@beep/law-practice-domain"
   *
   * type Wire = FederalRuleCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof FederalRuleCitation.Encoded;
}
