/**
 * Line-transform pipeline helper backing the streaming process tool.
 *
 * Applies an ordered list of pure line transforms over a file's lines, tracking
 * processed/failed/skipped counts, wall-clock duration (via {@link Clock}), and
 * per-item failures as `{ item, error, stage }`. The built-in transforms are
 * total functions, so the failure path exists for completeness and for
 * `stopOnError` semantics rather than because the stages throw.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpMcpId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Clock, Effect, flow } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readLines } from "./TextStream.ts";

const $I = $NlpMcpId.create("Streaming/Pipeline");
const NonNegativeInteger = S.Int.check(S.isGreaterThanOrEqualTo(0));
const PositiveInteger = S.Int.check(S.isGreaterThan(0));

const PipelineStageBase = LiteralKit(["lowercase", "normalizeWhitespace", "removePunctuation", "trim", "uppercase"]);

/**
 * Identifier of a supported, pure line transform stage.
 *
 * **Example** (Parse stage from string)
 *
 * ```ts
 * import { PipelineStage } from "@beep/nlp-mcp/Streaming/Pipeline"
 *
 * const stage = PipelineStage.fromUnknown("normalizeWhitespace")
 * console.log(stage)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PipelineStage = PipelineStageBase.pipe(
  $I.annoteSchema("PipelineStage", {
    description: "Identifier of a supported, pure line transform stage.",
  }),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

/**
 * Type for {@link PipelineStage}.
 *
 * **Example** (Type array of stages)
 *
 * ```ts
 * import type { PipelineStage } from "@beep/nlp-mcp/Streaming/Pipeline"
 *
 * const stages: ReadonlyArray<PipelineStage> = ["trim", "lowercase"]
 * console.log(stages.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PipelineStage = typeof PipelineStage.Type;

/**
 * A single pipeline failure entry describing the item, message, and stage.
 *
 * **Example** (Construct pipeline error)
 *
 * ```ts
 * import { PipelineError } from "@beep/nlp-mcp/Streaming/Pipeline"
 *
 * const error = PipelineError.make({ error: "failed", item: "raw", stage: "trim" })
 * console.log(error.stage)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PipelineError extends S.Class<PipelineError>($I`PipelineError`)(
  {
    error: S.String.annotateKey({
      description: "Message describing why the item failed.",
    }),
    item: S.Unknown.annotateKey({
      description: "The input item that failed (line text or upstream value).",
    }),
    stage: S.String.annotateKey({
      description: "Name of the stage that produced the failure.",
    }),
  },
  $I.annote("PipelineError", {
    description: "A single pipeline failure entry describing the item, message, and stage.",
  })
) {}

/**
 * Outcome of running a line-transform pipeline over a file.
 *
 * **Example** (Construct pipeline result)
 *
 * ```ts
 * import { PipelineResult } from "@beep/nlp-mcp/Streaming/Pipeline"
 *
 * const result = PipelineResult.make({
 *   durationMs: 1,
 *   errors: [],
 *   failed: 0,
 *   processed: 1,
 *   results: ["hello"],
 *   skipped: 0
 * })
 * console.log(result.processed)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PipelineResult extends S.Class<PipelineResult>($I`PipelineResult`)(
  {
    durationMs: NonNegativeInteger.annotateKey({
      description: "Wall-clock duration of the run in milliseconds.",
    }),
    errors: S.Array(PipelineError).annotateKey({
      description: "Collected per-item failures.",
    }),
    failed: NonNegativeInteger.annotateKey({
      description: "Number of items that failed a stage.",
    }),
    processed: NonNegativeInteger.annotateKey({
      description: "Number of items processed to completion.",
    }),
    results: S.Array(S.Unknown).annotateKey({
      description: "Transformed output values in input order.",
    }),
    skipped: NonNegativeInteger.annotateKey({
      description: "Number of items skipped before processing.",
    }),
  },
  $I.annote("PipelineResult", {
    description: "Outcome of running a line-transform pipeline over a file.",
  })
) {}

/**
 * Options for running a line-transform pipeline.
 *
 * **Example** (Construct process options)
 *
 * ```ts
 * import { PipelineProcessOptions } from "@beep/nlp-mcp/Streaming/Pipeline"
 *
 * const options = PipelineProcessOptions.make({ maxLines: 10, skipEmpty: true })
 * console.log(options.maxLines)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PipelineProcessOptions extends S.Class<PipelineProcessOptions>($I`PipelineProcessOptions`)(
  {
    maxLines: PositiveInteger.pipe(SchemaUtils.withKeyDefaults(Number.MAX_SAFE_INTEGER)).annotateKey({
      description: "Maximum number of raw lines to read before processing.",
    }),
    skipEmpty: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description: "Drop lines that are empty after trimming before applying stages.",
    }),
    stopOnError: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description:
        "Reserved for future custom stages. The built-in transform stages are total and never fail, so this option currently has no effect.",
    }),
  },
  $I.annote("PipelineProcessOptions", {
    description: "Options for running a line-transform pipeline.",
  })
) {}

const stageTransform: (stage: PipelineStage) => (value: string) => string = PipelineStage.$match({
  lowercase: () => Str.toLowerCase,
  normalizeWhitespace: () => flow(Str.replace(/\s+/g, " "), Str.trim),
  removePunctuation: () => Str.replace(/[^\w\s]/g, ""),
  trim: () => Str.trim,
  uppercase: () => Str.toUpperCase,
});

const applyStages = (stages: ReadonlyArray<PipelineStage>, value: string): string =>
  A.reduce(stages, value, (acc, stage) => stageTransform(stage)(acc));

/**
 * Run an ordered list of line transforms over the lines of a file.
 *
 * **Details**
 *
 * Lines are read via {@link readLines} (optionally skipping blanks), each
 * surviving line is folded through `stages`, and aggregate counts plus duration
 * are returned. `maxLines` caps how many lines are considered; `stopOnError`
 * stops processing after the first failure (the built-in stages never fail, so
 * this only affects future custom stages).
 *
 * **Example** (Process file with stages)
 *
 * ```ts
 * import { processFile } from "@beep/nlp-mcp/Streaming/Pipeline"
 *
 * console.log(processFile("/tmp/data.txt", ["trim", "lowercase"], { skipEmpty: true }))
 * ```
 *
 * @effects Reads the Effect `Clock` before and after processing, and reads file
 * content through {@link readLines}, which requires `FileSystem` and `Path` and
 * can fail with `PlatformError`.
 * @category processes
 * @since 0.0.0
 */
export const processFile = Effect.fn("Pipeline.processFile")(function* (
  filePath: string,
  stages: ReadonlyArray<PipelineStage>,
  options: (typeof PipelineProcessOptions)["~type.make.in"] = {}
) {
  const processOptions = PipelineProcessOptions.make(options);
  const startedAt = yield* Clock.currentTimeMillis;

  // Read raw lines (blanks included) so we can report how many were skipped;
  // `maxLines` still caps how many raw lines are read.
  const allLines = yield* readLines(filePath, { maxLines: processOptions.maxLines });
  const lines = processOptions.skipEmpty ? A.filter(allLines, (line) => Str.isNonEmpty(Str.trim(line))) : allLines;
  const skipped = A.length(allLines) - A.length(lines);

  const results = A.map(lines, (line) => applyStages(stages, line));
  const finishedAt = yield* Clock.currentTimeMillis;

  return PipelineResult.make({
    durationMs: finishedAt - startedAt,
    errors: A.empty<PipelineError>(),
    failed: 0,
    processed: A.length(results),
    results,
    skipped,
  });
});
