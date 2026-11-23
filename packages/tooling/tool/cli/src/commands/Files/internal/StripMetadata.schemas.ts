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
export class StripMetadataPlanEntry extends S.Opaque<StripMetadataPlanEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    extension: S.String,
    mediaKind: MediaKind,
    size: S.BigInt,
    sourceName: S.String,
    sourcePath: S.String,
  }).pipe(
    $I.annoteSchema("StripMetadataPlanEntry", {
      description: "A direct media file selected for metadata stripping.",
    })
  )
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
export class StripMetadataSummary extends S.Opaque<StripMetadataSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    directory: S.String,
    dryRun: S.Boolean,
    imageCount: S.Finite,
    plannedCount: S.Finite,
    skippedCount: S.Finite,
    strippedCount: S.Finite,
    videoCount: S.Finite,
  }).pipe(
    $I.annoteSchema("StripMetadataSummary", {
      description: "Summary counts for an image and video metadata stripping run.",
    })
  )
) {}

/**
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
export class StripMetadataPlan extends S.Opaque<StripMetadataPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    entries: S.Array(StripMetadataPlanEntry),
    imageCount: S.Finite,
    skippedCount: S.Finite,
    videoCount: S.Finite,
  }).pipe(
    $I.annoteSchema("StripMetadataPlan", {
      description: "Planned metadata stripping entries plus direct media files skipped before processing.",
    })
  )
) {}
