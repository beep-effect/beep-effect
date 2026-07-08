/**
 * The CollectionSummary value object module for the `@beep/govinfo` driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GovinfoId } from "@beep/identity";
import * as S from "effect/Schema";
import { SummaryItem } from "../SummaryItem/index.ts";

const $I = $GovinfoId.create("domain/values/CollectionSummary/CollectionSummary.model");

/**
 * List of GovInfo collections and their package/granule counts.
 *
 * @example
 * ```ts
 * import { CollectionSummary } from "@beep/govinfo/domain/values/CollectionSummary/CollectionSummary.model";
 * import * as S from "effect/Schema";
 *
 * const summary = S.decodeUnknownSync(CollectionSummary)([
 *   {
 *     collectionCode: "CREC",
 *     collectionName: "Congressional Record",
 *     granuleCount: 1200n,
 *     packageCount: 450n
 *   }
 * ]);
 *
 * console.log(summary[0]?.collectionCode);
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export const CollectionSummary = S.Array(SummaryItem).pipe(
  $I.annoteSchema("CollectionSummary", {
    description: "List of GovInfo collections and their package/granule counts.",
  })
);

/**
 * Decoded collection summary array type.
 *
 * @example
 * ```ts
 * import { CollectionSummary } from "@beep/govinfo/domain/values/CollectionSummary/CollectionSummary.model";
 * import type { CollectionSummary as CollectionSummaryValue } from "@beep/govinfo/domain/values/CollectionSummary/CollectionSummary.model";
 * import * as S from "effect/Schema";
 *
 * const summary: CollectionSummaryValue = S.decodeUnknownSync(CollectionSummary)([
 *   {
 *     collectionCode: "CREC",
 *     collectionName: "Congressional Record",
 *     granuleCount: 1200n,
 *     packageCount: 450n
 *   }
 * ]);
 *
 * console.log(summary.length);
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CollectionSummary = typeof CollectionSummary.Type;

/**
 * Companion namespace for {@link CollectionSummary} encoded helpers.
 *
 * @example
 * ```ts
 * import { CollectionSummary } from "@beep/govinfo/domain/values/CollectionSummary/CollectionSummary.model";
 * import type { CollectionSummary as CollectionSummaryValue } from "@beep/govinfo/domain/values/CollectionSummary/CollectionSummary.model";
 * import * as S from "effect/Schema";
 *
 * const summary: CollectionSummaryValue = S.decodeUnknownSync(CollectionSummary)([
 *   {
 *     collectionCode: "CREC",
 *     collectionName: "Congressional Record",
 *     granuleCount: 1200n,
 *     packageCount: 450n
 *   }
 * ]);
 *
 * console.log(summary.length);
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CollectionSummary {
  /**
   * Encoded JSON shape accepted by {@link CollectionSummary}.
   *
   * @example
   * ```ts
   * import { CollectionSummary } from "@beep/govinfo/domain/values/CollectionSummary/CollectionSummary.model";
   * import * as S from "effect/Schema";
   *
   * const decoded = S.decodeUnknownSync(CollectionSummary)([
   *   {
   *     collectionCode: "FR",
   *     collectionName: "Federal Register",
   *     granuleCount: 3000n,
   *     packageCount: 1500n
   *   }
   * ]);
   * const encoded: CollectionSummary.Encoded = S.encodeSync(CollectionSummary)(decoded);
   *
   * console.log(encoded[0]?.collectionName);
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CollectionSummary.Encoded;
}
