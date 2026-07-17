/**
 * History-link value object: one link in a subsequent-history chain, pairing the
 * case at a position with the disposition signal that led to it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationId } from "../CitationId/index.ts";
import { HistorySignal } from "../HistorySignal/index.ts";

const $I = $LawPracticeDomainId.create("values/HistoryLink/HistoryLink.model");

/**
 * One link in a subsequent-history chain (#849): the case at this position,
 * paired with the disposition {@link HistorySignal} that led TO it.
 *
 * The chain root has no inbound signal, so `signal` is `Option<HistorySignal>`
 * with a `None` constructor default — `None` marks the root link.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { CitationId, HistoryLink } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const root = HistoryLink.make({
 *   citationId: S.decodeUnknownSync(CitationId)("c0"),
 * })
 *
 * const affirmed = HistoryLink.make({
 *   citationId: S.decodeUnknownSync(CitationId)("c1"),
 *   signal: O.some("affirmed"),
 * })
 *
 * console.log(O.isNone(root.signal)) // true
 * console.log(O.isSome(affirmed.signal)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HistoryLink extends S.Class<HistoryLink>($I`HistoryLink`)(
  {
    citationId: CitationId.annotateKey({
      description: "The case at this position in the subsequent-history chain (#849).",
    }),
    signal: HistorySignal.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "The disposition signal that led to this case; absent for the chain root, which has no inbound signal (#849).",
      })
    ),
  },
  $I.annote("HistoryLink", {
    description: "One link in a subsequent-history chain (#849).",
  })
) {}

/**
 * Companion namespace for `HistoryLink`.
 *
 * @example
 * ```ts
 * import type { HistoryLink } from "@beep/law-practice-domain"
 *
 * const identityField: keyof HistoryLink.Encoded = "citationId"
 * console.log(identityField) // "citationId"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace HistoryLink {
  /**
   * Wire-encoded representation of a decoded {@link HistoryLink}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { HistoryLink } from "@beep/law-practice-domain"
   *
   * type Wire = HistoryLink.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof HistoryLink.Encoded;
}
