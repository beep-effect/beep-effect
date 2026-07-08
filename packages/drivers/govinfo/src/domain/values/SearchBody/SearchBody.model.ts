/**
 * The SearchBody value object module for the `@beep/govinfo` driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GovinfoId } from "@beep/identity";
import { PosInt } from "@beep/schema";
import * as S from "effect/Schema";
import { Sort } from "../Sort/index.ts";

const $I = $GovinfoId.create("domain/values/SearchBody/SearchBody.model");

/**
 * GovInfo search request body.
 *
 * @remarks
 * The `query` field accepts GovInfo search syntax, including field operators
 * such as `collection:(CREC)` and `congress:118`. Sort field support is
 * controlled by GovInfo; for example, `score` is relevance-only and should be
 * requested with `DESC`.
 *
 * @example
 * ```ts
 * import { SearchBody } from "@beep/govinfo/domain/values/SearchBody/SearchBody.model";
 * import * as S from "effect/Schema";
 *
 * const body = S.decodeUnknownSync(SearchBody)({
 *   historical: false,
 *   offsetMark: "*",
 *   pageSize: 10,
 *   query: "collection:(FR) agency:(Environmental Protection Agency)",
 *   resultLevel: "default",
 *   sorts: [{ field: "publishdate", sortOrder: "DESC" }]
 * });
 *
 * console.log(body.sorts[0]?.sortOrder);
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class SearchBody extends S.Class<SearchBody>($I`SearchBody`)(
  {
    historical: S.Boolean.annotateKey({
      description: "Whether the search should include historical GovInfo content when supported.",
    }),
    offsetMark: S.String.annotateKey({
      description: "Cursor for search pagination; initial requests usually use `*`.",
    }),
    pageSize: PosInt.annotateKey({
      description: "Number of search results requested for the current page.",
    }),
    query: S.String.annotateKey({
      description: "GovInfo search query string, including supported field operators.",
    }),
    resultLevel: S.String.annotateKey({
      description: "GovInfo result granularity requested by the caller.",
    }),
    sorts: S.Array(Sort).annotateKey({
      description: "Sort directives applied to the GovInfo search result set.",
    }),
  },
  $I.annote("SearchBody", {
    description: "GovInfo search request body.",
  })
) {}

/**
 * Companion namespace for {@link SearchBody} encoded helpers.
 *
 * @example
 * ```ts
 * import { SearchBody } from "@beep/govinfo/domain/values/SearchBody/SearchBody.model";
 * import * as S from "effect/Schema";
 *
 * const body: SearchBody = S.decodeUnknownSync(SearchBody)({
 *   historical: false,
 *   offsetMark: "*",
 *   pageSize: 10,
 *   query: "collection:(CREC) congress:118",
 *   resultLevel: "default",
 *   sorts: [{ field: "publishdate", sortOrder: "DESC" }]
 * });
 *
 * console.log(body.query);
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SearchBody {
  /**
   * Encoded JSON shape accepted by {@link SearchBody}.
   *
   * @example
   * ```ts
   * import { SearchBody } from "@beep/govinfo/domain/values/SearchBody/SearchBody.model";
   * import * as S from "effect/Schema";
   *
   * const decoded = S.decodeUnknownSync(SearchBody)({
   *   historical: false,
   *   offsetMark: "*",
   *   pageSize: 10,
   *   query: "collection:(USCOURTS)",
   *   resultLevel: "default",
   *   sorts: [{ field: "score", sortOrder: "DESC" }]
   * });
   * const encoded: SearchBody.Encoded = S.encodeSync(SearchBody)(decoded);
   *
   * console.log(encoded.query);
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SearchBody.Encoded;
}
