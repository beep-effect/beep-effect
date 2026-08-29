/**
 * Subsequent-history-entry value object: a single subsequent history entry from
 * a case citation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import { HistorySignal } from "../HistorySignal/index.ts";
import { Span } from "../Span/index.ts";

const $I = $LawPracticeDomainId.create("values/SubsequentHistoryEntry/SubsequentHistoryEntry.model");

/**
 * A single subsequent history entry from a case citation.
 *
 * **Details**
 *
 * Pairs the normalized {@link HistorySignal} classification with the `rawSignal`
 * text as it appeared, the {@link Span} locating that text in the document, and
 * the zero-based `order` of this entry within the history chain.
 *
 * **Example** (Affirmed history entry)
 *
 * ```ts
 * import { Span, SubsequentHistoryEntry } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const entry = SubsequentHistoryEntry.make({
 *   signal: "affirmed",
 *   rawSignal: "aff'd",
 *   signalSpan: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(5),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(5),
 *   }),
 *   order: NonNegativeInt.make(0),
 * })
 *
 * console.log(entry.signal) // "affirmed"
 * console.log(entry.order) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SubsequentHistoryEntry extends S.Class<SubsequentHistoryEntry>($I`SubsequentHistoryEntry`)(
  {
    signal: HistorySignal.annotateKey({
      description: "Normalized signal classification.",
    }),
    rawSignal: S.String.annotateKey({
      description: "Raw signal text as it appeared in the document.",
    }),
    signalSpan: Span.annotateKey({
      description: "Position of the signal text in the document.",
    }),
    order: NonNegativeInt.annotateKey({
      description: "Order in the history chain (0-based).",
    }),
  },
  $I.annote("SubsequentHistoryEntry", {
    description: "A single subsequent history entry from a case citation.",
  })
) {}

/**
 * Companion namespace for `SubsequentHistoryEntry`.
 *
 * **Example** (Encoded type alias)
 *
 * ```ts
 * import type { SubsequentHistoryEntry } from "@beep/law-practice-domain"
 *
 * type SubsequentHistoryWire = SubsequentHistoryEntry.Encoded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace SubsequentHistoryEntry {
  /**
   * Wire-encoded representation of a decoded {@link SubsequentHistoryEntry}.
   *
   * **Example** (Wire type alias)
   *
   * ```ts
   * import type { SubsequentHistoryEntry } from "@beep/law-practice-domain"
   *
   * type Wire = SubsequentHistoryEntry.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof SubsequentHistoryEntry.Encoded;
}
