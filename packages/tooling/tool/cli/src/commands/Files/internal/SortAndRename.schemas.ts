/**
 * Sort-and-rename planning schemas for Files commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { MediaDimensions, MediaKind } from "./Media.schemas.ts";

const $I = $RepoCliId.create("commands/Files/internal/SortAndRename.schemas");

/**
 * File discovered for deterministic rename planning.
 *
 * @example
 * ```ts
 * import { SortableFile } from "@beep/repo-cli/commands/Files/index"
 *
 * const file = SortableFile.make({
 *   canonicalPath: "/tmp/images/a.png",
 *   extension: ".png",
 *   name: "a.png",
 *   size: 10n,
 *   sourcePath: "/tmp/images/a.png"
 * })
 * console.log(file.name)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SortableFile extends S.Class<SortableFile>($I`SortableFile`)(
  {
    canonicalPath: S.String,
    extension: S.String,
    mediaKind: S.Option(MediaKind).pipe(S.withConstructorDefault(Effect.succeed(O.none<MediaKind>()))),
    name: S.String,
    size: S.BigInt,
    sourcePath: S.String,
  },
  $I.annote("SortableFile", {
    description: "A direct regular file selected for size-based rename planning.",
  })
) {}

/**
 * Planned rename from an existing file path to a generated target path.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { RenamePlanEntry } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(RenamePlanEntry)(undefined)
 * ```
 * @category models
 * @since 0.0.0
 */
export class RenamePlanEntry extends S.Class<RenamePlanEntry>($I`RenamePlanEntry`)(
  {
    canonicalSourcePath: S.String,
    dimensions: S.Option(S.suspend(() => MediaDimensions)).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<MediaDimensions>()))
    ),
    extension: S.String,
    index: S.Finite,
    size: S.BigInt,
    sourceName: S.String,
    sourcePath: S.String,
    targetName: S.String,
    targetPath: S.String,
  },
  $I.annote("RenamePlanEntry", {
    description: "A single source-to-target file rename planned by a files operation.",
  })
) {}

/**
 * Summary returned by `sortAndRenameFiles`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { SortAndRenameSummary } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(SortAndRenameSummary)(undefined)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SortAndRenameSummary extends S.Class<SortAndRenameSummary>($I`SortAndRenameSummary`)(
  {
    directory: S.String,
    dryRun: S.Boolean,
    plannedCount: S.Finite,
    renamedCount: S.Finite,
    skippedCount: S.Finite,
    withDimensions: S.Boolean,
  },
  $I.annote("SortAndRenameSummary", {
    description: "Summary counts for a sort-and-rename file curation run.",
  })
) {}

/**
 * Files selected for rename planning plus skipped file counts.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { SortableFileCollection } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(SortableFileCollection)(undefined)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SortableFileCollection extends S.Class<SortableFileCollection>($I`SortableFileCollection`)(
  {
    files: S.Array(SortableFile),
    skippedCount: S.Finite,
  },
  $I.annote("SortableFileCollection", {
    description: "Files selected for rename planning plus direct regular files skipped by media filtering.",
  })
) {}

/**
 * Planned rename entries plus skipped file counts.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { RenamePlan } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(RenamePlan)(undefined)
 * ```
 * @category models
 * @since 0.0.0
 */
export class RenamePlan extends S.Class<RenamePlan>($I`RenamePlan`)(
  {
    entries: S.Array(RenamePlanEntry),
    skippedCount: S.Finite,
  },
  $I.annote("RenamePlan", {
    description: "Planned rename entries plus direct regular files skipped before planning.",
  })
) {}
