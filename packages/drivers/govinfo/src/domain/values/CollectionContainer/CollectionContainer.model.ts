/**
 * The CollectionContainer value object module for the `@beep/govinfo` driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GovinfoId } from "@beep/identity";
import * as S from "effect/Schema";
import { PackageInfo } from "../PackageInfo/index.ts";

const $I = $GovinfoId.create("domain/values/CollectionContainer/CollectionContainer.model");

/**
 * Paginated GovInfo collection response containing package summaries.
 *
 * **Details**
 *
 * GovInfo collection traversal starts with `offsetMark=*`; subsequent cursors
 * are exposed through `nextPage` rather than a numeric offset.
 *
 * **Example** (Decode collection container response)
 *
 * ```ts
 * import { CollectionContainer } from "@beep/govinfo/domain/values/CollectionContainer/CollectionContainer.model";
 * import * as S from "effect/Schema";
 *
 * const container = S.decodeUnknownSync(CollectionContainer)({
 *   count: 1,
 *   message: "",
 *   nextPage: "https://api.govinfo.gov/collections/CREC/2024-01-01T00:00:00Z?offsetMark=next&pageSize=10",
 *   packages: [
 *     {
 *       congress: "118",
 *       dateIssued: "2024-01-03T00:00:00Z",
 *       docClass: "CREC",
 *       lastModified: "2024-01-04T12:00:00Z",
 *       packageLink: "https://api.govinfo.gov/packages/CREC-2024-01-03/summary",
 *       title: "Congressional Record, January 3, 2024"
 *     }
 *   ],
 *   previousPage: ""
 * });
 *
 * console.log(container.packages[0]?.title);
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class CollectionContainer extends S.Class<CollectionContainer>($I`CollectionContainer`)(
  {
    /** Total matching packages reported by the collection endpoint. */
    count: S.Int.pipe(
      S.check(S.makeFilterGroup([S.isInt32(), S.isGreaterThanOrEqualTo(0), S.isFinite()])),
      S.annotateKey({
        description: "Total matching packages reported by the collection endpoint.",
      })
    ),

    /** Human-readable API message, when GovInfo includes one. */
    message: S.String.annotateKey({
      description: "Human-readable API message, when GovInfo includes one.",
    }),

    /** URL for the next page of collection results. */
    nextPage: S.String.annotateKey({
      description: "URL for the next page of collection results.",
    }),

    /** Package summaries returned for the current collection page. */
    packages: PackageInfo.pipe(
      S.Array,
      S.annotateKey({
        description: "Package summaries returned for the current collection page.",
      })
    ),

    /** URL for the previous page of collection results. */
    previousPage: S.String.annotateKey({
      description: "URL for the previous page of collection results.",
    }),
  },
  $I.annote("CollectionContainer", {
    description: "Paginated GovInfo collection response containing package summaries.",
  })
) {}

/**
 * Companion namespace for {@link CollectionContainer} encoded helpers.
 *
 * **Example** (Decode empty collection container)
 *
 * ```ts
 * import { CollectionContainer } from "@beep/govinfo/domain/values/CollectionContainer/CollectionContainer.model";
 * import * as S from "effect/Schema";
 *
 * const container: CollectionContainer = S.decodeUnknownSync(CollectionContainer)({
 *   count: 1,
 *   message: "",
 *   nextPage: "",
 *   packages: [],
 *   previousPage: ""
 * });
 *
 * console.log(container.count);
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CollectionContainer {
  /**
   * Encoded JSON shape accepted by {@link CollectionContainer}.
   *
   * **Example** (Encode decoded collection container)
   *
   * ```ts
   * import { CollectionContainer } from "@beep/govinfo/domain/values/CollectionContainer/CollectionContainer.model";
   * import * as S from "effect/Schema";
   *
   * const decoded = S.decodeUnknownSync(CollectionContainer)({
   *   count: 1,
   *   message: "",
   *   nextPage: "https://api.govinfo.gov/collections/CREC/2024-01-01T00:00:00Z?offsetMark=next&pageSize=10",
   *   packages: [
   *     {
   *       congress: "118",
   *       dateIssued: "2024-01-03T00:00:00Z",
   *       docClass: "CREC",
   *       lastModified: "2024-01-04T12:00:00Z",
   *       packageLink: "https://api.govinfo.gov/packages/CREC-2024-01-03/summary",
   *       title: "Congressional Record, January 3, 2024"
   *     }
   *   ],
   *   previousPage: ""
   * });
   * const encoded: CollectionContainer.Encoded = S.encodeSync(CollectionContainer)(decoded);
   *
   * console.log(encoded.count);
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CollectionContainer.Encoded;
}
