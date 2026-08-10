/**
 * The GranuleContainer value object module for the `@beep/govinfo` driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GovinfoId } from "@beep/identity";
import { NonNegativeInt, PosInt } from "@beep/schema";
import * as S from "effect/Schema";
import { NonNegativeInt64 } from "../GovinfoNumeric.ts";
import { GranuleMetadata } from "../GranuleMetadata/index.ts";

const $I = $GovinfoId.create("domain/values/GranuleContainer/GranuleContainer.model");

/**
 * Paginated GovInfo granule listing for a package.
 *
 * **Details**
 *
 * Package granule listings expose subsections of a document package and use
 * `offsetMark`/page URLs for traversal, similar to collection pages.
 *
 * **Example** (Decode package granule listing)
 *
 * ```ts
 * import { GranuleContainer } from "@beep/govinfo/domain/values/GranuleContainer/GranuleContainer.model";
 * import * as S from "effect/Schema";
 *
 * const container = S.decodeUnknownSync(GranuleContainer)({
 *   count: 1n,
 *   granules: [
 *     {
 *       granuleClass: "HOUSE",
 *       granuleId: "CREC-2024-01-03-pt1-PgH1",
 *       granuleLink: "https://api.govinfo.gov/packages/CREC-2024-01-03/granules/CREC-2024-01-03-pt1-PgH1/summary",
 *       md5: "d41d8cd98f00b204e9800998ecf8427e",
 *       title: "House proceedings"
 *     }
 *   ],
 *   message: "",
 *   nextPage: "https://api.govinfo.gov/packages/CREC-2024-01-03/granules?offsetMark=next&pageSize=100",
 *   offset: 0,
 *   pageSize: 100,
 *   previousPage: ""
 * });
 *
 * console.log(container.granules[0]?.granuleId);
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class GranuleContainer extends S.Class<GranuleContainer>($I`GranuleContainer`)(
  {
    /** Total matching granules reported by GovInfo. */
    count: NonNegativeInt64.pipe(
      S.annotateKey({
        description: "Total matching granules reported by GovInfo.",
      })
    ),

    /** Granule summaries returned for the current page. */
    granules: GranuleMetadata.pipe(
      S.Array,
      S.annotateKey({
        description: "Granule summaries returned for the current page.",
      })
    ),

    /** Human-readable API message, when GovInfo includes one. */
    message: S.String.annotateKey({
      description: "Human-readable API message, when GovInfo includes one.",
    }),

    /** URL for the next page of granule results. */
    nextPage: S.String.annotateKey({
      description: "URL for the next page of granule results.",
    }),

    /** Numeric offset reported by older GovInfo granule list responses. */
    offset: NonNegativeInt.annotateKey({
      description: "Numeric offset reported by older GovInfo granule list responses.",
    }),

    /** Number of granules requested for the current page. */
    pageSize: PosInt.annotateKey({
      description: "Number of granules requested for the current page.",
    }),

    /** URL for the previous page of granule results. */
    previousPage: S.String.annotateKey({
      description: "URL for the previous page of granule results.",
    }),
  },
  $I.annote("GranuleContainer", {
    description: "Paginated GovInfo granule listing for a package.",
  })
) {}

/**
 * Companion namespace for {@link GranuleContainer} encoded helpers.
 *
 * **Example** (Decode empty granule container)
 *
 * ```ts
 * import { GranuleContainer } from "@beep/govinfo/domain/values/GranuleContainer/GranuleContainer.model";
 * import * as S from "effect/Schema";
 *
 * const container: GranuleContainer = S.decodeUnknownSync(GranuleContainer)({
 *   count: 1n,
 *   granules: [],
 *   message: "",
 *   nextPage: "",
 *   offset: 0,
 *   pageSize: 100,
 *   previousPage: ""
 * });
 *
 * console.log(container.pageSize);
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GranuleContainer {
  /**
   * Encoded JSON shape accepted by {@link GranuleContainer}.
   *
   * **Example** (Encode decoded granule container)
   *
   * ```ts
   * import { GranuleContainer } from "@beep/govinfo/domain/values/GranuleContainer/GranuleContainer.model";
   * import * as S from "effect/Schema";
   *
   * const decoded = S.decodeUnknownSync(GranuleContainer)({
   *   count: 1n,
   *   granules: [
   *     {
   *       granuleClass: "HOUSE",
   *       granuleId: "CREC-2024-01-03-pt1-PgH1",
   *       granuleLink: "https://api.govinfo.gov/packages/CREC-2024-01-03/granules/CREC-2024-01-03-pt1-PgH1/summary",
   *       md5: "d41d8cd98f00b204e9800998ecf8427e",
   *       title: "House proceedings"
   *     }
   *   ],
   *   message: "",
   *   nextPage: "https://api.govinfo.gov/packages/CREC-2024-01-03/granules?offsetMark=next&pageSize=100",
   *   offset: 0,
   *   pageSize: 100,
   *   previousPage: ""
   * });
   * const encoded: GranuleContainer.Encoded = S.encodeSync(GranuleContainer)(decoded);
   *
   * console.log(encoded.pageSize);
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof GranuleContainer.Encoded;
}
