/**
 * Metadata stripping schemas for Files commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { MediaKind } from "./Media.schemas.ts";

const $I = $RepoCliId.create("commands/Files/internal/StripMetadata.schemas");

/**
 * Image extension schema supported by metadata stripping.
 *
 * **Example** (Check schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SupportedMetadataImageExtension } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(SupportedMetadataImageExtension)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SupportedMetadataImageExtension = LiteralKit(["avif", "jpeg", "jpg", "png", "tif", "tiff", "webp"]).pipe(
  $I.annoteSchema("SupportedMetadataImageExtension", {
    description: "Image file extensions that the metadata-strip command normalizes through sharp.",
  })
);

/**
 * Image extension supported by metadata stripping.
 *
 * @category models
 * @since 0.0.0
 */
export type SupportedMetadataImageExtension = typeof SupportedMetadataImageExtension.Type;

/**
 * Planned metadata strip for a selected image or video file.
 *
 * **Example** (Construct plan entry instance)
 *
 * ```ts
 * import { StripMetadataPlanEntry } from "@beep/repo-cli/commands/Files/index"
 *
 * const entry = StripMetadataPlanEntry.make({
 *   extension: ".jpg",
 *   mediaKind: "image",
 *   size: 10n,
 *   sourceName: "photo.jpg",
 *   sourcePath: "/tmp/dataset/photo.jpg"
 * })
 * console.log(entry.mediaKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StripMetadataPlanEntry extends S.Class<StripMetadataPlanEntry>($I`StripMetadataPlanEntry`)(
  {
    extension: S.String,
    mediaKind: MediaKind,
    size: S.BigInt,
    sourceName: S.String,
    sourcePath: S.String,
  },
  $I.annote("StripMetadataPlanEntry", {
    description: "A direct media file selected for metadata stripping.",
  })
) {}

/**
 * Summary returned by `stripMetadataFiles`.
 *
 * **Example** (Check schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { StripMetadataSummary } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(StripMetadataSummary)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StripMetadataSummary extends S.Class<StripMetadataSummary>($I`StripMetadataSummary`)(
  {
    directory: S.String,
    dryRun: S.Boolean,
    imageCount: S.Finite,
    plannedCount: S.Finite,
    skippedCount: S.Finite,
    strippedCount: S.Finite,
    videoCount: S.Finite,
  },
  $I.annote("StripMetadataSummary", {
    description: "Summary counts for an image and video metadata stripping run.",
  })
) {}

/**
 * Planned metadata stripping entries plus skipped file counts.
 *
 * **Example** (Check schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { StripMetadataPlan } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(StripMetadataPlan)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StripMetadataPlan extends S.Class<StripMetadataPlan>($I`StripMetadataPlan`)(
  {
    entries: S.Array(StripMetadataPlanEntry),
    imageCount: S.Finite,
    skippedCount: S.Finite,
    videoCount: S.Finite,
  },
  $I.annote("StripMetadataPlan", {
    description: "Planned metadata stripping entries plus direct media files skipped before processing.",
  })
) {}
