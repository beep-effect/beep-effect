/**
 * Extraction schema models for corpus curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.js";

const $I = $RepoCliId.create("commands/Corpus/internal/Extract.schemas");

/**
 * Validated options used by `corpus extract`.
 *
 * @example
 * ```ts
 * import { CorpusExtractOptions } from "@beep/repo-cli/commands/Corpus"
 *
 * const options = CorpusExtractOptions.make({
 *   corpusRoot: "/data/corpus",
 *   exportChildren: true,
 *   includeDuplicates: false,
 *   overwrite: false,
 *   tikaJarPath: "/opt/tika/tika-app.jar"
 * })
 * console.log(options.exportChildren) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusExtractOptions extends S.Class<CorpusExtractOptions>($I`CorpusExtractOptions`)(
  {
    concurrency: S.optionalKey(S.Finite),
    corpusRoot: S.String,
    exportChildren: S.Boolean,
    includeDuplicates: S.Boolean,
    javaPath: S.optionalKey(S.String),
    maxFiles: S.optionalKey(S.Finite),
    outLabel: S.optionalKey(S.String),
    overwrite: S.Boolean,
    pffexportPath: S.optionalKey(S.String),
    sourceLabel: S.optionalKey(S.String),
    tikaJarPath: S.String,
  },
  $I.annote("CorpusExtractOptions", {
    description: "Validated options used by corpus extract.",
  })
) {}

/**
 * Summary counts returned by `corpus extract`.
 *
 * @example
 * ```ts
 * import { CorpusExtractSummary } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const summary = CorpusExtractSummary.make({
 *   childArtifactCount: NonNegativeInt.make(1),
 *   duplicatesSkipped: NonNegativeInt.make(0),
 *   failedCount: NonNegativeInt.make(0),
 *   skippedCount: NonNegativeInt.make(0),
 *   sourceCount: NonNegativeInt.make(2),
 *   succeededCount: NonNegativeInt.make(2),
 *   textArtifactCount: NonNegativeInt.make(2)
 * })
 * console.log(summary.succeededCount) // 2
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusExtractSummary extends S.Class<CorpusExtractSummary>($I`CorpusExtractSummary`)(
  {
    childArtifactCount: NonNegativeInt,
    duplicatesSkipped: NonNegativeInt,
    failedCount: NonNegativeInt,
    skippedCount: NonNegativeInt,
    sourceCount: NonNegativeInt,
    succeededCount: NonNegativeInt,
    textArtifactCount: NonNegativeInt,
  },
  $I.annote("CorpusExtractSummary", {
    description: "Summary counts returned by corpus extract.",
  })
) {}

/**
 * JSON encoder for {@link CorpusExtractSummary}.
 *
 * @example
 * ```ts
 * import { CorpusExtractSummary, encodeCorpusExtractSummaryJson } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const summary = CorpusExtractSummary.make({
 *   childArtifactCount: NonNegativeInt.make(0),
 *   duplicatesSkipped: NonNegativeInt.make(0),
 *   failedCount: NonNegativeInt.make(0),
 *   skippedCount: NonNegativeInt.make(0),
 *   sourceCount: NonNegativeInt.make(1),
 *   succeededCount: NonNegativeInt.make(1),
 *   textArtifactCount: NonNegativeInt.make(1)
 * })
 *
 * Effect.runPromise(encodeCorpusExtractSummaryJson(summary)).then((json) => console.log(json.includes("\"sourceCount\":1"))) // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusExtractSummaryJson = JsonStringCodec(CorpusExtractSummary).encode;
