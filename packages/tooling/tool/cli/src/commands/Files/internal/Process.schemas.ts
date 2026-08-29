/**
 * File-processing proof schemas for Files commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FileProcessingEngineFamily } from "@beep/file-processing/Strategy";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Files/internal/Process.schemas");

/**
 * Failure policy for `files process`.
 *
 * **Example** (Check schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ProcessFilesFailurePolicy } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(ProcessFilesFailurePolicy)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProcessFilesFailurePolicy = LiteralKit(["continue", "fail-on-error"]).pipe(
  $I.annoteSchema("ProcessFilesFailurePolicy", {
    description: "Controls whether files process returns a failing exit code when source processing records fail.",
  })
);

/**
 * Failure policy for `files process`.
 *
 * @category models
 * @since 0.0.0
 */
export type ProcessFilesFailurePolicy = typeof ProcessFilesFailurePolicy.Type;

/**
 * Validated options used by `files process`.
 *
 * **Example** (Check schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ProcessFilesOptions } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(ProcessFilesOptions)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProcessFilesOptions extends S.Class<ProcessFilesOptions>($I`ProcessFilesOptions`)(
  {
    engine: FileProcessingEngineFamily,
    exportChildren: S.Boolean,
    failurePolicy: ProcessFilesFailurePolicy,
    input: S.String,
    javaPath: S.optionalKey(S.String),
    maxMaterializedBytes: S.optionalKey(S.Finite),
    outDir: S.String,
    overwrite: S.Boolean,
    pffexportPath: S.optionalKey(S.String),
    tikaJarPath: S.optionalKey(S.String),
    tikaUrl: S.optionalKey(S.String),
  },
  $I.annote("ProcessFilesOptions", {
    description: "Validated options used by files process.",
  })
) {}

/**
 * Summary counts returned by `files process`.
 *
 * **Example** (Check schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ProcessFilesSummary } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(ProcessFilesSummary)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProcessFilesSummary extends S.Class<ProcessFilesSummary>($I`ProcessFilesSummary`)(
  {
    failedCount: NonNegativeInt,
    skippedCount: NonNegativeInt,
    sourceCount: NonNegativeInt,
    succeededCount: NonNegativeInt,
    textArtifactCount: NonNegativeInt,
  },
  $I.annote("ProcessFilesSummary", {
    description: "Summary counts returned by files process.",
  })
) {}
