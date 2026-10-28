/**
 * Case-group value object: a group of citations all referring to the same
 * underlying case, ported from the eyecite `CaseGroup` interface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import * as S from "effect/Schema";
import { Citation, FullCaseCitation } from "../Citation/index.ts";

const $I = $LawPracticeDomainId.create("values/CaseGroup/CaseGroup.model");

/**
 * A group of citations all referring to the same underlying case.
 *
 * **Details**
 *
 * Produced by `groupByCase()` from resolved extraction results. Groups are
 * ordered by first mention in the document: the `primaryCitation` is the first
 * full citation encountered, `mentions` collects every reference in document
 * order, and `parallelCitations` lists the distinct reporter strings.
 *
 * **Example** (Constructing CaseGroup with make)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CaseGroup } from "@beep/law-practice-domain"
 *
 * const group = S.decodeEffect(CaseGroup)({
 *   primaryCitation: {
 *     type: "case", components: { volume: "410", reporter: "U.S.", page: "113" },
 *     publication: { vocabularyVersion: "crv1:f353e51400a5:fad63b383b92", editions: [], selectedEdition: null },
 *     metadata: { pinCite: null, parenthetical: null, year: null, month: null, day: null, court: null,
 *       plaintiff: null, defendant: null, additionalText: null, antecedentGuess: null, shortCaseName: null, caseName: null }
 *   },
 *   mentions: [], parallelCitations: ["410 U.S. 113"]
 * })
 * console.log(group !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CaseGroup extends S.Opaque<CaseGroup, { readonly brand: unique symbol }>()(
  S.Struct({
    primaryCitation: FullCaseCitation.annotateKey({
      description: "The first full citation encountered for this case.",
    }),
    mentions: S.Array(Citation).annotateKey({
      description:
        "All mentions (full, short, id, supra) in document order. Each is a Citation that may additionally carry resolution metadata (see ResolutionResult); the distributive-conditional resolution augmentation is a type-level concern not expressible as a runtime schema.",
    }),
    parallelCitations: S.Array(S.String).annotateKey({
      description: 'Distinct reporter strings: ["550 U.S. 544", "127 S. Ct. 1955"].',
    }),
  }).pipe(
    $I.annoteSchema("CaseGroup", {
      description: "A group of citations all referring to the same underlying case.",
    })
  )
) {}

/**
 * Companion namespace for `CaseGroup`.
 *
 * **Example** (Using Encoded parallelCitations)
 *
 * ```ts
 * import type { CaseGroup } from "@beep/law-practice-domain"
 *
 * const reporters: CaseGroup.Encoded["parallelCitations"] = ["410 U.S. 113"]
 * console.log(reporters.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace CaseGroup {
  /**
   * Wire-encoded representation of a decoded {@link CaseGroup}.
   *
   * **Example** (Aliasing CaseGroup Encoded type)
   *
   * ```ts
   * import type { CaseGroup } from "@beep/law-practice-domain"
   *
   * type Wire = CaseGroup.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof CaseGroup.Encoded;
}
