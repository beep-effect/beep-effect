/**
 * Flatten-media option and summary schemas for Files commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Files/internal/FlattenMedia.schemas");

/**
 * Options used by the recursive media flattening operation.
 *
 * @example
 * ```ts
 * import { FlattenMediaOptions } from "@beep/repo-cli/commands/Files"
 *
 * const options = FlattenMediaOptions.make({
 *   dir: "./raw",
 *   outDir: "./flat"
 * })
 * console.log(options.dryRun)
 * ```
 * @category models
 * @since 0.0.0
 */
export class FlattenMediaOptions extends S.Class<FlattenMediaOptions>($I`FlattenMediaOptions`)(
  {
    dir: S.String,
    dryRun: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    outDir: S.String,
  },
  $I.annote("FlattenMediaOptions", {
    description: "Source, destination, and preview options for recursively flattening media files.",
  })
) {}

/**
 * Summary returned by `flattenMediaFiles`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { FlattenMediaSummary } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(FlattenMediaSummary)(undefined)
 * console.log(acceptsUndefined)
 * ```
 * @category models
 * @since 0.0.0
 */
export class FlattenMediaSummary extends S.Class<FlattenMediaSummary>($I`FlattenMediaSummary`)(
  {
    collisionCount: S.Finite,
    destinationDirectory: S.String,
    dryRun: S.Boolean,
    movedCount: S.Finite,
    plannedCount: S.Finite,
    skippedCount: S.Finite,
    sourceDirectory: S.String,
  },
  $I.annote("FlattenMediaSummary", {
    description: "Summary counts and resolved directories for a recursive media flattening run.",
  })
) {}

/**
 * Decode unknown recursive media flattening options.
 *
 * @example
 * ```ts
 * import { decodeFlattenMediaOptions } from "@beep/repo-cli/commands/Files"
 * import { Effect } from "effect"
 *
 * const program = decodeFlattenMediaOptions(undefined)
 * console.log(Effect.isEffect(program))
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeFlattenMediaOptions: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<FlattenMediaOptions, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<FlattenMediaOptions, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(FlattenMediaOptions));
