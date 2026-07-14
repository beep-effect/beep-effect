/**
 * String-citation-group value object: citations chained for one proposition
 * ("See A; B; C"), ported from the eyecite `StringCitationGroup` interface
 * (#857).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationId } from "../CitationId/index.js";
import { CitationSignal } from "../CitationSignal/index.js";

const $I = $LawPracticeDomainId.create("values/StringCitationGroup/StringCitationGroup.model");

/**
 * A string-citation group (#857): citations chained for one proposition
 * ("See A; B; C").
 *
 * Members reference all members (including self) by stable {@link CitationId} in
 * document order, so the group survives consumer filter/sort/map of the result
 * set. `signal` is the group's leading {@link CitationSignal}, modeled as
 * `Option<CitationSignal>` with a `None` constructor default.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { CitationId, StringCitationGroup } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const group = StringCitationGroup.make({
 *   memberIds: [CitationId.make("c0"), CitationId.make("c1"), CitationId.make("c2")],
 * })
 *
 * console.log(group.memberIds.length) // 3
 * console.log(O.isNone(group.signal)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StringCitationGroup extends S.Class<StringCitationGroup>($I`StringCitationGroup`)(
  {
    memberIds: S.Array(CitationId).annotateKey({
      description: "Stable CitationIds of all group members (including self) in document order.",
    }),
    signal: CitationSignal.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "The group's leading citation signal, when present.",
      })
    ),
  },
  $I.annote("StringCitationGroup", {
    description: 'A string-citation group: citations chained for one proposition ("See A; B; C") (#857).',
  })
) {}

/**
 * Companion namespace for `StringCitationGroup`.
 *
 * @example
 * ```ts
 * import type { StringCitationGroup } from "@beep/law-practice-domain"
 *
 * type StringCitationGroupWire = StringCitationGroup.Encoded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace StringCitationGroup {
  /**
   * Wire-encoded representation of a decoded {@link StringCitationGroup}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { StringCitationGroup } from "@beep/law-practice-domain"
   *
   * type Wire = StringCitationGroup.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof StringCitationGroup.Encoded;
}
