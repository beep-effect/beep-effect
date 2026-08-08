/**
 * Caption sidecar schemas for Files commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Files/internal/CreateCaptions.schemas");

/**
 * Reason a direct directory entry was skipped by `files create-captions`.
 *
 * **Example** (Check schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CreateCaptionFilesSkippedReason } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(CreateCaptionFilesSkippedReason)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CreateCaptionFilesSkippedReason = LiteralKit([
  "caption-exists",
  "caption-target-collision",
  "caption-target-not-file",
  "directory",
  "extensionless",
  "non-media",
  "symlink",
  "video",
]).pipe(
  $I.annoteSchema("CreateCaptionFilesSkippedReason", {
    description: "Reason a source entry was not selected for caption sidecar creation.",
  })
);

/**
 * Reason a direct directory entry was skipped by `files create-captions`.
 *
 * @category models
 * @since 0.0.0
 */
export type CreateCaptionFilesSkippedReason = typeof CreateCaptionFilesSkippedReason.Type;

/**
 * Options used by caption sidecar creation.
 *
 * **Example** (Check schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CreateCaptionFilesOptions } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(CreateCaptionFilesOptions)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CreateCaptionFilesOptions extends S.Class<CreateCaptionFilesOptions>($I`CreateCaptionFilesOptions`)(
  {
    caption: S.String.pipe(S.withConstructorDefault(Effect.succeed(""))),
    dir: S.String,
    dryRun: S.Boolean,
    overwrite: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
  },
  $I.annote("CreateCaptionFilesOptions", {
    description: "Validated options used by files create-captions.",
  })
) {}

/**
 * Planned caption sidecar file creation.
 *
 * **Example** (Check schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CreateCaptionFilesPlanEntry } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(CreateCaptionFilesPlanEntry)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CreateCaptionFilesPlanEntry extends S.Class<CreateCaptionFilesPlanEntry>($I`CreateCaptionFilesPlanEntry`)(
  {
    captionName: S.String,
    captionPath: S.String,
    captionRelativePath: S.String,
    extension: S.String,
    overwritesExisting: S.Boolean,
    sourceName: S.String,
    sourcePath: S.String,
    sourceRelativePath: S.String,
  },
  $I.annote("CreateCaptionFilesPlanEntry", {
    description: "A same-stem caption sidecar planned for an image file.",
  })
) {}

/**
 * Source entry skipped by caption sidecar creation.
 *
 * **Example** (Check schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CreateCaptionFilesSkippedEntry } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(CreateCaptionFilesSkippedEntry)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CreateCaptionFilesSkippedEntry extends S.Class<CreateCaptionFilesSkippedEntry>(
  $I`CreateCaptionFilesSkippedEntry`
)(
  {
    captionName: S.optionalKey(S.String),
    extension: S.optionalKey(S.String),
    message: S.String,
    reason: CreateCaptionFilesSkippedReason,
    sourceName: S.String,
    sourcePath: S.String,
  },
  $I.annote("CreateCaptionFilesSkippedEntry", {
    description: "A direct source entry skipped by files create-captions with a machine-readable reason.",
  })
) {}

/**
 * Planned caption sidecar creation run.
 *
 * **Example** (Check schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CreateCaptionFilesPlan } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(CreateCaptionFilesPlan)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CreateCaptionFilesPlan extends S.Class<CreateCaptionFilesPlan>($I`CreateCaptionFilesPlan`)(
  {
    caption: S.String,
    directory: S.String,
    entries: S.Array(CreateCaptionFilesPlanEntry),
    overwrite: S.Boolean,
    skipped: S.Array(CreateCaptionFilesSkippedEntry),
  },
  $I.annote("CreateCaptionFilesPlan", {
    description: "Planned caption sidecar entries plus skipped source entries.",
  })
) {}

/**
 * Summary returned by `createCaptionFiles`.
 *
 * **Example** (Check schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CreateCaptionFilesSummary } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(CreateCaptionFilesSummary)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CreateCaptionFilesSummary extends S.Class<CreateCaptionFilesSummary>($I`CreateCaptionFilesSummary`)(
  {
    createdCount: S.Finite,
    directory: S.String,
    dryRun: S.Boolean,
    overwrittenCount: S.Finite,
    plannedCount: S.Finite,
    skippedCount: S.Finite,
  },
  $I.annote("CreateCaptionFilesSummary", {
    description: "Summary counts returned by files create-captions.",
  })
) {}

/**
 * Decode unknown caption sidecar creation options.
 *
 * **Example** (Decode undefined options)
 *
 * ```ts
 * import { decodeCreateCaptionFilesOptions } from "@beep/repo-cli/commands/Files"
 *
 * const program = decodeCreateCaptionFilesOptions(undefined)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeCreateCaptionFilesOptions: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<CreateCaptionFilesOptions, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<CreateCaptionFilesOptions, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(CreateCaptionFilesOptions));
