/**
 * History-chain value object: a subsequent-history chain (#849), ordered
 * root → latest, that references its members by stable {@link CitationId}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import * as S from "effect/Schema";
import { HistoryLink } from "../HistoryLink/index.ts";

const $I = $LawPracticeDomainId.create("values/HistoryChain/HistoryChain.model");

/**
 * A subsequent-history chain (#849), ordered root → latest.
 *
 * **Details**
 *
 * Built after citation ids are assigned and attached (shared) to every member,
 * the chain references its members by stable {@link CitationId} so it survives
 * filter/sort/map of the result array. Each entry is a {@link HistoryLink}
 * pairing a member id with the history signal connecting it to the next.
 *
 * **Example** (Empty chain construction)
 *
 * ```ts
 * import { HistoryChain } from "@beep/law-practice-domain"
 *
 * const chain = HistoryChain.make({ links: [] })
 *
 * console.log(chain.links.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HistoryChain extends S.Class<HistoryChain>($I`HistoryChain`)(
  {
    links: S.Array(HistoryLink).annotateKey({
      description: "History links, ordered root → latest, referencing members by stable CitationId (#849).",
    }),
  },
  $I.annote("HistoryChain", {
    description: "A subsequent-history chain (#849), ordered root → latest.",
  })
) {}

/**
 * Companion namespace for `HistoryChain`.
 *
 * **Example** (Encoded links type access)
 *
 * ```ts
 * import type { HistoryChain } from "@beep/law-practice-domain"
 *
 * const links: HistoryChain.Encoded["links"] = []
 * console.log(links.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace HistoryChain {
  /**
   * Wire-encoded representation of a decoded {@link HistoryChain}.
   *
   * **Example** (Encoded wire type alias)
   *
   * ```ts
   * import type { HistoryChain } from "@beep/law-practice-domain"
   *
   * type Wire = HistoryChain.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof HistoryChain.Encoded;
}
