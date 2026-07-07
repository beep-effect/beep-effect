/**
 * The SummaryItem value object module for the `@beep/govinfo` driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GovinfoId } from "@beep/identity";
import * as S from "effect/Schema";
import { NonNegativeInt64 } from "../GovinfoNumeric.ts";

const $I = $GovinfoId.create("domain/values/SummaryItem/SummaryItem.model");

/**
 * GovInfo collection summary row with collection identifiers and counts.
 *
 * @remarks
 * `collectionCode` is the short GovInfo collection identifier used in API
 * paths and search filters, such as `CREC`, `FR`, `BILLS`, or `USCOURTS`.
 *
 * @example
 * ```ts
 * import { SummaryItem } from "@beep/govinfo/domain/values/SummaryItem/SummaryItem.model";
 * import * as S from "effect/Schema";
 *
 * const item = S.decodeUnknownSync(SummaryItem)({
 *   collectionCode: "FR",
 *   collectionName: "Federal Register",
 *   granuleCount: 10000n,
 *   packageCount: 2500n
 * });
 *
 * console.log(item.collectionName);
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class SummaryItem extends S.Class<SummaryItem>($I`SummaryItem`)(
  {
    /** Short GovInfo collection code used in routes and search filters. */
    collectionCode: S.String.annotateKey({
      description: "Short GovInfo collection code used in routes and search filters.",
    }),

    /** Human-readable GovInfo collection name. */
    collectionName: S.String.annotateKey({
      description: "Human-readable GovInfo collection name.",
    }),

    /** Number of granules reported for the collection. */
    granuleCount: NonNegativeInt64.annotateKey({
      description: "Number of granules reported for the collection.",
    }),

    /** Number of packages reported for the collection. */
    packageCount: NonNegativeInt64.pipe(
      S.annotateKey({
        description: "Number of packages reported for the collection.",
      })
    ),
  },
  $I.annote("SummaryItem", {
    description: "GovInfo collection summary row with collection identifiers and counts.",
  })
) {}

/**
 * Companion namespace for {@link SummaryItem} encoded helpers.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SummaryItem {
  /**
   * Encoded JSON shape accepted by {@link SummaryItem}.
   *
   * @example
   * ```ts
   * import { SummaryItem } from "@beep/govinfo/domain/values/SummaryItem/SummaryItem.model";
   * import * as S from "effect/Schema";
   *
   * const decoded = S.decodeUnknownSync(SummaryItem)({
   *   collectionCode: "USCOURTS",
   *   collectionName: "United States Courts Opinions",
   *   granuleCount: 5000n,
   *   packageCount: 1250n
   * });
   * const encoded: SummaryItem.Encoded = S.encodeSync(SummaryItem)(decoded);
   *
   * console.log(encoded.collectionCode);
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SummaryItem.Encoded;
}
