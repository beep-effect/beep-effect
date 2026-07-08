/**
 * The PackageInfo value object module for the `@beep/govinfo` driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GovinfoId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $GovinfoId.create("domain/values/PackageInfo/PackageInfo.model");

/**
 * GovInfo package metadata returned by collection and published listings.
 *
 * @remarks
 * GovInfo packages group the content files and metadata needed to understand a
 * publication. `dateIssued` is the publication date, while `lastModified`
 * reflects when GovInfo added or updated the package.
 *
 * @example
 * ```ts
 * import { PackageInfo } from "@beep/govinfo/domain/values/PackageInfo/PackageInfo.model";
 * import * as S from "effect/Schema";
 *
 * const info = S.decodeUnknownSync(PackageInfo)({
 *   congress: "118",
 *   dateIssued: "2024-01-03T00:00:00Z",
 *   docClass: "CREC",
 *   lastModified: "2024-01-04T12:00:00Z",
 *   packageLink: "https://api.govinfo.gov/packages/CREC-2024-01-03/summary",
 *   title: "Congressional Record, January 3, 2024"
 * });
 *
 * console.log(info.packageLink);
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class PackageInfo extends S.Class<PackageInfo>($I`PackageInfo`)(
  {
    /** Congress number associated with the package when applicable. */
    congress: S.String.annotateKey({
      description: "Congress number associated with the package when applicable.",
    }),

    /** Publication date for the package content. */
    dateIssued: S.DateTimeUtcFromString.annotateKey({
      description: "Publication date for the package content.",
    }),

    /** Collection-specific document class, such as bill type or CREC section. */
    docClass: S.String.annotateKey({
      description: "Collection-specific document class, such as bill type or CREC section.",
    }),

    /** Time GovInfo last added or updated the package. */
    lastModified: S.DateTimeUtcFromString.annotateKey({
      description: "Time GovInfo last added or updated the package.",
    }),

    /** API URL for the package summary resource. */
    packageLink: S.String.annotateKey({
      description: "API URL for the package summary resource.",
    }),

    /** Display title for the GovInfo package. */
    title: S.String.annotateKey({
      description: "Display title for the GovInfo package.",
    }),
  },
  $I.annote("PackageInfo", {
    description: "GovInfo package metadata returned by collection and published listings.",
  })
) {}

/**
 * Companion namespace for {@link PackageInfo} encoded helpers.
 *
 * @example
 * ```ts
 * import { PackageInfo } from "@beep/govinfo/domain/values/PackageInfo/PackageInfo.model";
 * import * as S from "effect/Schema";
 *
 * const info: PackageInfo = S.decodeUnknownSync(PackageInfo)({
 *   congress: "118",
 *   dateIssued: "2024-01-03T00:00:00Z",
 *   docClass: "CREC",
 *   lastModified: "2024-01-04T12:00:00Z",
 *   packageLink: "https://api.govinfo.gov/packages/CREC-2024-01-03/summary",
 *   title: "Congressional Record, January 3, 2024"
 * });
 *
 * console.log(info.title);
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PackageInfo {
  /**
   * Encoded JSON shape accepted by {@link PackageInfo}.
   *
   * @example
   * ```ts
   * import { PackageInfo } from "@beep/govinfo/domain/values/PackageInfo/PackageInfo.model";
   * import * as S from "effect/Schema";
   *
   * const decoded = S.decodeUnknownSync(PackageInfo)({
   *   congress: "118",
   *   dateIssued: "2024-01-03T00:00:00Z",
   *   docClass: "CREC",
   *   lastModified: "2024-01-04T12:00:00Z",
   *   packageLink: "https://api.govinfo.gov/packages/CREC-2024-01-03/summary",
   *   title: "Congressional Record, January 3, 2024"
   * });
   * const encoded: PackageInfo.Encoded = S.encodeSync(PackageInfo)(decoded);
   *
   * console.log(encoded.title);
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PackageInfo.Encoded;
}
