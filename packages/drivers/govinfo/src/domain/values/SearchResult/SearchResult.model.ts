/**
 * The SearchResult value object module for the `@beep/govinfo` driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GovinfoId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $GovinfoId.create("domain/values/SearchResult/SearchResult.model");

/**
 * Single GovInfo search hit with package, granule, and download metadata.
 *
 * @remarks
 * Search results may refer to a whole package or a package granule. GovInfo
 * package and granule identifiers are unique and can be used to retrieve
 * summaries, metadata, and content from retrieval endpoints.
 *
 * @example
 * ```ts
 * import { SearchResult } from "@beep/govinfo/domain/values/SearchResult/SearchResult.model";
 * import * as S from "effect/Schema";
 *
 * const result = S.decodeUnknownSync(SearchResult)({
 *   collectionCode: "FR",
 *   dateIngested: "2024-01-05T00:00:00Z",
 *   dateIssued: "2024-01-04T00:00:00Z",
 *   download: {
 *     pdfLink: "https://api.govinfo.gov/packages/FR-2024-01-04/pdf",
 *     xmlLink: "https://api.govinfo.gov/packages/FR-2024-01-04/xml"
 *   },
 *   governmentAuthor: ["National Archives and Records Administration"],
 *   granuleId: "2024-00001",
 *   lastModified: "2024-01-05T14:30:00Z",
 *   packageId: "FR-2024-01-04",
 *   resultLink: "https://api.govinfo.gov/packages/FR-2024-01-04/summary",
 *   title: "Federal Register, Volume 89 Issue 2"
 * });
 *
 * console.log(result.packageId);
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class SearchResult extends S.Class<SearchResult>($I`SearchResult`)(
  {
    /** GovInfo collection code for the result. */
    collectionCode: S.String.annotateKey({
      description: "GovInfo collection code for the result.",
    }),
    /** Time the result was ingested into GovInfo. */
    dateIngested: S.DateTimeUtcFromString.annotateKey({
      description: "Time the result was ingested into GovInfo.",
    }),
    /** Publication date for the package or granule content. */
    dateIssued: S.DateTimeUtcFromString.annotateKey({
      description: "Publication date for the package or granule content.",
    }),
    /** Map of available download format names to API URLs. */
    download: S.Record(S.String, S.String).annotateKey({
      description: "Map of available download format names to API URLs.",
      documentation: "GovInfo commonly returns keys such as pdfLink, xmlLink, modsLink, premisLink, and zipLink.",
    }),
    /** Government authors credited for the result. */
    governmentAuthor: S.String.pipe(
      S.Array,
      S.annotateKey({
        description: "Government authors credited for the result.",
      })
    ),
    /** Granule identifier when the result targets a package subsection. */
    granuleId: S.String.annotateKey({
      description: "Granule identifier when the result targets a package subsection.",
    }),
    /** Time GovInfo last added or updated the result. */
    lastModified: S.DateTimeUtcFromString.annotateKey({
      description: "Time GovInfo last added or updated the result.",
    }),
    /** Unique GovInfo package identifier. */
    packageId: S.String.annotateKey({
      description: "Unique GovInfo package identifier.",
    }),
    /** API URL for the result summary. */
    resultLink: S.String.annotateKey({
      description: "API URL for the result summary.",
    }),
    /** Display title for the search result. */
    title: S.String.annotateKey({
      description: "Display title for the search result.",
    }),
  },
  $I.annote("SearchResult", {
    description: "Single GovInfo search hit with package, granule, and download metadata.",
  })
) {}

/**
 * Companion namespace for {@link SearchResult} encoded helpers.
 *
 * @example
 * ```ts
 * import { SearchResult } from "@beep/govinfo/domain/values/SearchResult/SearchResult.model";
 * import * as S from "effect/Schema";
 *
 * const result: SearchResult = S.decodeUnknownSync(SearchResult)({
 *   collectionCode: "FR",
 *   dateIngested: "2024-01-05T00:00:00Z",
 *   dateIssued: "2024-01-04T00:00:00Z",
 *   download: { pdfLink: "https://api.govinfo.gov/packages/FR-2024-01-04/pdf" },
 *   governmentAuthor: ["National Archives and Records Administration"],
 *   granuleId: "2024-00001",
 *   lastModified: "2024-01-05T14:30:00Z",
 *   packageId: "FR-2024-01-04",
 *   resultLink: "https://api.govinfo.gov/packages/FR-2024-01-04/summary",
 *   title: "Federal Register, Volume 89 Issue 2"
 * });
 *
 * console.log(result.packageId);
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SearchResult {
  /**
   * Encoded JSON shape accepted by {@link SearchResult}.
   *
   * @example
   * ```ts
   * import { SearchResult } from "@beep/govinfo/domain/values/SearchResult/SearchResult.model";
   * import * as S from "effect/Schema";
   *
   * const decoded = S.decodeUnknownSync(SearchResult)({
   *   collectionCode: "FR",
   *   dateIngested: "2024-01-05T00:00:00Z",
   *   dateIssued: "2024-01-04T00:00:00Z",
   *   download: {
   *     pdfLink: "https://api.govinfo.gov/packages/FR-2024-01-04/pdf"
   *   },
   *   governmentAuthor: ["National Archives and Records Administration"],
   *   granuleId: "2024-00001",
   *   lastModified: "2024-01-05T14:30:00Z",
   *   packageId: "FR-2024-01-04",
   *   resultLink: "https://api.govinfo.gov/packages/FR-2024-01-04/summary",
   *   title: "Federal Register, Volume 89 Issue 2"
   * });
   * const encoded: SearchResult.Encoded = S.encodeSync(SearchResult)(decoded);
   *
   * console.log(encoded.collectionCode);
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SearchResult.Encoded;
}
