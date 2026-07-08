/**
 * The SearchResponse value object module for the `@beep/govinfo` driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GovinfoId } from "@beep/identity";
import * as S from "effect/Schema";
import { SearchResult } from "../SearchResult/index.ts";

const $I = $GovinfoId.create("domain/values/SearchResponse/SearchResponse.model");

/**
 * GovInfo search response with a result count, cursor, and hits.
 *
 * @example
 * ```ts
 * import { SearchResponse } from "@beep/govinfo/domain/values/SearchResponse/SearchResponse.model";
 * import * as S from "effect/Schema";
 *
 * const response = S.decodeUnknownSync(SearchResponse)({
 *   count: 1,
 *   offsetMark: "next-cursor",
 *   results: [
 *     {
 *       collectionCode: "FR",
 *       dateIngested: "2024-01-05T00:00:00Z",
 *       dateIssued: "2024-01-04T00:00:00Z",
 *       download: { pdfLink: "https://api.govinfo.gov/packages/FR-2024-01-04/pdf" },
 *       governmentAuthor: ["National Archives and Records Administration"],
 *       granuleId: "2024-00001",
 *       lastModified: "2024-01-05T14:30:00Z",
 *       packageId: "FR-2024-01-04",
 *       resultLink: "https://api.govinfo.gov/packages/FR-2024-01-04/summary",
 *       title: "Federal Register, Volume 89 Issue 2"
 *     }
 *   ]
 * });
 *
 * console.log(response.results.length);
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class SearchResponse extends S.Class<SearchResponse>($I`SearchResponse`)(
  {
    count: S.Int.pipe(
      S.check(S.makeFilterGroup([S.isInt32(), S.isFinite(), S.isGreaterThanOrEqualTo(0)])),
      S.annotateKey({
        description: "Total number of matching GovInfo search results.",
      })
    ),
    offsetMark: S.String.annotateKey({
      description: "Cursor returned by GovInfo for retrieving the next search page.",
    }),
    results: SearchResult.pipe(
      S.Array,
      S.annotateKey({
        description: "Search hits returned for the current page.",
      })
    ),
  },
  $I.annote("SearchResponse", {
    description: "GovInfo search response with a result count, cursor, and hits.",
  })
) {}

/**
 * Companion namespace for {@link SearchResponse} encoded helpers.
 *
 * @example
 * ```ts
 * import { SearchResponse } from "@beep/govinfo/domain/values/SearchResponse/SearchResponse.model";
 * import * as S from "effect/Schema";
 *
 * const response: SearchResponse = S.decodeUnknownSync(SearchResponse)({
 *   count: 1,
 *   offsetMark: "next-cursor",
 *   results: []
 * });
 *
 * console.log(response.count);
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SearchResponse {
  /**
   * Encoded JSON shape accepted by {@link SearchResponse}.
   *
   * @example
   * ```ts
   * import { SearchResponse } from "@beep/govinfo/domain/values/SearchResponse/SearchResponse.model";
   * import * as S from "effect/Schema";
   *
   * const decoded = S.decodeUnknownSync(SearchResponse)({
   *   count: 1,
   *   offsetMark: "next-cursor",
   *   results: [
   *     {
   *       collectionCode: "FR",
   *       dateIngested: "2024-01-05T00:00:00Z",
   *       dateIssued: "2024-01-04T00:00:00Z",
   *       download: { pdfLink: "https://api.govinfo.gov/packages/FR-2024-01-04/pdf" },
   *       governmentAuthor: ["National Archives and Records Administration"],
   *       granuleId: "2024-00001",
   *       lastModified: "2024-01-05T14:30:00Z",
   *       packageId: "FR-2024-01-04",
   *       resultLink: "https://api.govinfo.gov/packages/FR-2024-01-04/summary",
   *       title: "Federal Register, Volume 89 Issue 2"
   *     }
   *   ]
   * });
   * const encoded: SearchResponse.Encoded = S.encodeSync(SearchResponse)(decoded);
   *
   * console.log(encoded.offsetMark);
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SearchResponse.Encoded;
}
