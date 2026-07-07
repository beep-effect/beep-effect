/**
 * The GranuleMetadata value object module for the `@beep/govinfo` driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GovinfoId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $GovinfoId.create("domain/values/GranuleMetadata/GranuleMetadata.model");

const Md5Hex = S.String.check(
  S.isPattern(/^[0-9a-f]{32}$/i, {
    description: "A 32-character hexadecimal MD5 digest.",
    identifier: $I`Md5HexPatternCheck`,
    message: "Expected a 32-character hexadecimal MD5 digest",
    title: "MD5 hex digest",
  })
).pipe(
  $I.annoteSchema("Md5Hex", {
    description: "A 32-character hexadecimal MD5 digest.",
  })
);

/**
 * Metadata row for a GovInfo granule inside a package.
 *
 * @remarks
 * A granule is a subsection of a GovInfo package, such as a Federal Register
 * notice, a Congressional Record speech, or a chapter-level subdivision.
 *
 * @example
 * ```ts
 * import { GranuleMetadata } from "@beep/govinfo/domain/values/GranuleMetadata/GranuleMetadata.model";
 * import * as S from "effect/Schema";
 *
 * const granule = S.decodeUnknownSync(GranuleMetadata)({
 *   granuleClass: "HOUSE",
 *   granuleId: "CREC-2024-01-03-pt1-PgH1",
 *   granuleLink: "https://api.govinfo.gov/packages/CREC-2024-01-03/granules/CREC-2024-01-03-pt1-PgH1/summary",
 *   md5: "d41d8cd98f00b204e9800998ecf8427e",
 *   title: "House proceedings"
 * });
 *
 * console.log(granule.granuleId);
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class GranuleMetadata extends S.Class<GranuleMetadata>($I`GranuleMetadata`)(
  {
    /** Collection-specific granule classification. */
    granuleClass: S.String.annotateKey({
      description: "Collection-specific granule classification.",
    }),

    /** Unique GovInfo granule identifier within its package. */
    granuleId: S.String.annotateKey({
      description: "Unique GovInfo granule identifier within its package.",
    }),

    /** API URL for retrieving the granule summary. */
    granuleLink: S.String.annotateKey({
      description: "API URL for retrieving the granule summary.",
    }),

    /** MD5 hash exposed by GovInfo for granule content integrity checks. */
    md5: Md5Hex.annotateKey({
      description: "MD5 hash exposed by GovInfo for granule content integrity checks.",
    }),

    /** Display title for the granule. */
    title: S.String.annotateKey({
      description: "Display title for the granule.",
    }),
  },
  $I.annote("GranuleMetadata", {
    description: "Metadata row for a GovInfo granule inside a package.",
  })
) {}

/**
 * Companion namespace for {@link GranuleMetadata} encoded helpers.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GranuleMetadata {
  /**
   * Encoded JSON shape accepted by {@link GranuleMetadata}.
   *
   * @example
   * ```ts
   * import { GranuleMetadata } from "@beep/govinfo/domain/values/GranuleMetadata/GranuleMetadata.model";
   * import * as S from "effect/Schema";
   *
   * const decoded = S.decodeUnknownSync(GranuleMetadata)({
   *   granuleClass: "HOUSE",
   *   granuleId: "CREC-2024-01-03-pt1-PgH1",
   *   granuleLink: "https://api.govinfo.gov/packages/CREC-2024-01-03/granules/CREC-2024-01-03-pt1-PgH1/summary",
   *   md5: "d41d8cd98f00b204e9800998ecf8427e",
   *   title: "House proceedings"
   * });
   * const encoded: GranuleMetadata.Encoded = S.encodeSync(GranuleMetadata)(decoded);
   *
   * console.log(encoded.title);
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof GranuleMetadata.Encoded;
}
