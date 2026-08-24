/**
 * Positional export adapter for NLP tools.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { A, Struct } from "@beep/utils";
import { Cause, Effect, Inspectable, pipe, Stream } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import * as Obs from "../internal/observability.ts";
import { NlpToolkit, NlpTools } from "./NlpToolkit.ts";
import type { AiError, Toolkit } from "effect/unstable/ai";

const $I = $NlpProcessingId.create("Tools/ToolExport");

const TOOL_PARAMETER_NAMES: Partial<Record<string, ReadonlyArray<string>>> = {
  ChunkBySentences: ["text", "maxChunkChars"],
  CorpusStats: ["corpusId", "includeIdf", "includeMatrix", "topIdfTerms"],
  CreateCorpus: ["corpusId", "bm25Config"],
  LearnCorpus: ["corpusId", "documents", "dedupeById"],
  LearnCustomEntities: ["groupName", "mode", "entities"],
  NGrams: ["text", "size", "mode", "topN"],
  PhoneticMatch: ["text1", "text2", "algorithm", "minTokenLength"],
  QueryCorpus: ["corpusId", "query", "topN", "includeText"],
  RankByRelevance: ["texts", "query", "topN"],
  TransformText: ["text", "operations"],
  TverskySimilarity: ["text1", "text2", "alpha", "beta"],
};

const USAGE_EXAMPLES: Partial<Record<string, ReadonlyArray<string>>> = {
  ChunkBySentences: ['const { chunks } = await ChunkBySentences("One. Two. Three.", 1200)'],
  CorpusStats: ["const stats = await CorpusStats(corpusId, true, false, 20)"],
  CreateCorpus: ['const { corpusId } = await CreateCorpus("product-docs")'],
  LearnCorpus: ["await LearnCorpus(corpusId, [{ id: 'doc-1', text: 'Refund policy details' }], true)"],
  LearnCustomEntities: [
    "await LearnCustomEntities('custom-entities', 'append', [{ name: 'PERSON_NAME', patterns: ['[PROPN]', '[PROPN]'] }])",
  ],
  NGrams: ['const result = await NGrams("internationalization", 3, "bag", 10)'],
  PhoneticMatch: ['const result = await PhoneticMatch("Stephen Hawking", "Steven Hocking", "soundex", 2)'],
  QueryCorpus: ['const result = await QueryCorpus(corpusId, "refund policy", 5, true)'],
  RankByRelevance: ['const result = await RankByRelevance(["Cats are playful"], "cats", 1)'],
};

const DEFAULT_TIMEOUT_MS = 30_000;
type NlpTool = (typeof NlpTools)[number];
type NlpToolkitWithHandler = Toolkit.WithHandler<typeof NlpToolkit.tools>;

const renderError = (error: unknown): string => (P.isString(error) ? error : Inspectable.toStringUnknown(error));

const hasStructFields = (
  schema: unknown
): schema is {
  readonly fields: Record<string, unknown>;
} => P.hasProperty(schema, "fields") && P.isObject(schema.fields);

const parameterNamesForTool = (tool: NlpTool): ReadonlyArray<string> => {
  const overridden = TOOL_PARAMETER_NAMES[tool.name];
  return pipe(
    [
      O.fromUndefinedOr(overridden),
      pipe(
        tool.parametersSchema,
        O.liftPredicate(hasStructFields),
        O.map((schema) => Struct.keys(schema.fields))
      ),
    ] satisfies ReadonlyArray<O.Option<ReadonlyArray<string>>>,
    O.firstSomeOf,
    O.getOrElse(A.empty<string>)
  );
};

const ExportedToolErrorFields = {
  cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })),
  message: S.String,
  toolName: S.String,
} satisfies S.Struct.Fields;
const ExportedToolErrorEquivalenceFields = {
  // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
  message: ExportedToolErrorFields.message,
  toolName: ExportedToolErrorFields.toolName,
} satisfies S.Struct.Fields;
const sameExportedToolErrorFields = S.toEquivalence(
  S.TaggedStruct("ExportedToolError", ExportedToolErrorEquivalenceFields)
);
const sameExportedToolError = (self: ExportedToolError, that: ExportedToolError): boolean =>
  sameExportedToolErrorFields(self, that);

/**
 * Typed failure for the positional tool export adapter.
 *
 * **Details**
 *
 * The error preserves the tool name, a caller-facing message, and the original
 * unknown cause when parameter decoding, toolkit startup, stream execution, or
 * result extraction fails.
 *
 * **Example** (Recover from ExportedToolError)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ExportedToolError } from "@beep/nlp-processing/Tools/ToolExport"
 *
 * const recovered = await Effect.runPromise(
 *   Effect.fail(
 *     ExportedToolError.fromCause(new Error("missing text"), "Tokenize", {
 *       message: "Invalid parameters for Tokenize"
 *     })
 *   ).pipe(
 *     Effect.catchTag("ExportedToolError", (error) =>
 *       Effect.succeed(`${error.toolName}: ${error.message}`)
 *     )
 *   )
 * )
 *
 * if (recovered !== "Tokenize: Invalid parameters for Tokenize") {
 *   throw new Error(recovered)
 * }
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ExportedToolError extends S.TaggedError<ExportedToolError>($I`ExportedToolError`)(
  "ExportedToolError",
  ExportedToolErrorFields,
  $I.annoteClass<
    S.declare<ExportedToolError>,
    readonly [S.TaggedStruct<"ExportedToolError", typeof ExportedToolErrorFields>]
  >("ExportedToolError", {
    description: "Failure raised while exporting or executing a positional NLP tool.",

    toEquivalence: () => sameExportedToolError,
  })
) {
  /**
   * Convert an unknown cause into a typed export-adapter error.
   *
   * @param cause - The underlying failure or defect.
   * @param toolName - The tool name associated with the failure.
   * @param options - Additional rendered error detail for the caller.
   * @returns A typed export-adapter error value.
   */
  static readonly fromCause: {
    (
      cause: unknown,
      toolName: string,
      options: {
        readonly message: string;
      }
    ): ExportedToolError;
    (
      toolName: string,
      options: {
        readonly message: string;
      }
    ): (cause: unknown) => ExportedToolError;
  } = dual(
    3,
    (
      cause: unknown,
      toolName: string,
      options: {
        readonly message: string;
      }
    ): ExportedToolError =>
      ExportedToolError.make({
        cause: O.fromUndefinedOr(cause),
        message: options.message,
        toolName,
      })
  );
}

/**
 * Runtime descriptor for a tool exported as a positional function contract.
 *
 * **Details**
 *
 * The descriptor exposes stable argument ordering, JSON schemas, examples, and
 * an Effectful `handle` function that validates positional arguments before
 * delegating to the toolkit handler.
 *
 * **Example** (Define ExportedTool descriptor)
 *
 * ```ts
 * import { Effect } from "effect"
 * import type { ExportedTool } from "@beep/nlp-processing/Tools/ToolExport"
 *
 * const tokenizeDescriptor = {
 *   description: "Tokenize text",
 *   handle: (args: ReadonlyArray<unknown>) => Effect.succeed(args[0]),
 *   name: "Tokenize",
 *   parameterNames: ["text"],
 *   parametersJsonSchema: {},
 *   returnsJsonSchema: {},
 *   timeoutMs: 30_000,
 *   usageExamples: ['const result = await Tokenize("Hello world.")']
 * } satisfies ExportedTool
 *
 * tokenizeDescriptor.parameterNames
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface ExportedTool {
  readonly description: string;
  readonly handle: (args: ReadonlyArray<unknown>) => Effect.Effect<unknown, ExportedToolError>;
  readonly name: string;
  readonly parameterNames: ReadonlyArray<string>;
  readonly parametersJsonSchema: object;
  readonly returnsJsonSchema: object;
  readonly timeoutMs: number;
  readonly usageExamples: ReadonlyArray<string>;
}

const buildArgsObject = (
  parameterNames: ReadonlyArray<string>,
  args: ReadonlyArray<unknown>
): Record<string, unknown> =>
  A.reduce(parameterNames, R.empty<string, unknown>(), (output, name, index) =>
    P.isUndefined(args[index])
      ? output
      : {
          ...output,
          [name]: args[index],
        }
  );

const decodeToolParameters = (
  tool: NlpTool,
  parameterNames: ReadonlyArray<string>,
  args: ReadonlyArray<unknown>
): Effect.Effect<Tool.Parameters<NlpTool>, ExportedToolError> =>
  pipe(
    buildArgsObject(parameterNames, args),
    pipe(tool.parametersSchema, S.decodeEffect),
    Obs.trackNlpDuration("nlp.tool.decode_parameters", {
      argument_count: `${A.length(args)}`,
      operation: "decodeToolParameters",
      parameter_count: `${A.length(parameterNames)}`,
      tool: tool.name,
    }),
    Effect.mapError((cause) =>
      ExportedToolError.fromCause(cause, tool.name, {
        message: `Invalid parameters for ${tool.name}: ${renderError(cause)}`,
      })
    )
  );

const handleTool = (
  toolkit: NlpToolkitWithHandler,
  tool: NlpTool,
  params: Tool.Parameters<NlpTool>
): Effect.Effect<
  Stream.Stream<Tool.HandlerResult<NlpTool>, Tool.HandlerError<NlpTool> | AiError.AiError>,
  AiError.AiError
> =>
  // `Toolkit.handle` is keyed by a literal tool-name map. At this adapter boundary
  // we validate `params` against the selected tool schema immediately beforehand,
  // so the runtime pairing of tool name and decoded parameters is sound.
  toolkit.handle(tool.name as never, params as never) as Effect.Effect<
    Stream.Stream<Tool.HandlerResult<NlpTool>, Tool.HandlerError<NlpTool> | AiError.AiError>,
    AiError.AiError
  >;

const buildExportedTool: {
  (tool: NlpTool, toolkit: NlpToolkitWithHandler): ExportedTool;
  (toolkit: NlpToolkitWithHandler): (tool: NlpTool) => ExportedTool;
} = dual(2, (tool: NlpTool, toolkit: NlpToolkitWithHandler): ExportedTool => {
  const parameterNames = parameterNamesForTool(tool);

  return {
    description: Tool.getDescription(tool) ?? "",
    handle: Effect.fn("ToolExport.handle")(
      function* (args) {
        const attributes = {
          argument_count: `${A.length(args)}`,
          operation: "handle",
          parameter_count: `${A.length(parameterNames)}`,
          tool: tool.name,
        };
        return yield* Effect.gen(function* () {
          yield* Obs.annotateNlpSpan({
            ...attributes,
            phase: "decode",
          });
          const params = yield* decodeToolParameters(tool, parameterNames, args);
          yield* Obs.annotateNlpSpan({
            ...attributes,
            phase: "start",
          });
          const stream = yield* handleTool(toolkit, tool, params).pipe(
            Obs.trackNlpDuration("nlp.tool.start", attributes),
            Effect.mapError((cause) =>
              ExportedToolError.fromCause(cause, tool.name, {
                message: `Failed to start ${tool.name}: ${renderError(cause)}`,
              })
            )
          );
          yield* Obs.annotateNlpSpan({
            ...attributes,
            phase: "stream",
          });
          const last = yield* Stream.runLast(stream).pipe(
            Obs.trackNlpDuration("nlp.tool.stream", attributes),
            Effect.mapError((cause) =>
              ExportedToolError.fromCause(cause, tool.name, {
                message: `Tool ${tool.name} failed: ${renderError(cause)}`,
              })
            )
          );

          return yield* O.match(last, {
            onNone: () =>
              Obs.annotateNlpSpan({
                ...attributes,
                phase: "result",
                result_state: "empty",
              }).pipe(
                Effect.andThen(
                  Effect.fail(
                    ExportedToolError.fromCause(undefined, tool.name, {
                      message: `Tool ${tool.name} returned no result`,
                    })
                  )
                )
              ),
            onSome: (result) =>
              result.isFailure
                ? Obs.annotateNlpSpan({
                    ...attributes,
                    phase: "result",
                    result_state: "failure",
                  }).pipe(
                    Effect.andThen(
                      Effect.fail(
                        ExportedToolError.fromCause(result.result, tool.name, {
                          message: `Tool ${tool.name} failed: ${renderError(result.result)}`,
                        })
                      )
                    )
                  )
                : Obs.annotateNlpSpan({
                    ...attributes,
                    phase: "result",
                    result_state: "success",
                  }).pipe(Effect.as(result.encodedResult)),
          });
        }).pipe(Obs.observeNlpWorkflow("nlp.tool.handle", attributes));
      },
      Effect.catchCause((cause) =>
        Obs.recordNlpFailure(cause, {
          operation: "handle",
          tool: tool.name,
        }).pipe(
          Effect.andThen(
            Effect.fail(
              ExportedToolError.fromCause(cause, tool.name, {
                message: `Tool ${tool.name} failed: ${Cause.pretty(cause)}`,
              })
            )
          )
        )
      )
    ),
    name: tool.name,
    parameterNames,
    parametersJsonSchema: Tool.getJsonSchema(tool),
    returnsJsonSchema: Tool.getJsonSchemaFromSchema(tool.successSchema),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    usageExamples: USAGE_EXAMPLES[tool.name] ?? A.empty(),
  };
});

/**
 * @since 0.0.0
 * @category adapters
 */
const exportToolsEffect: Effect.Effect<
  ReadonlyArray<ExportedTool>,
  ExportedToolError,
  Tool.HandlersFor<typeof NlpToolkit.tools>
> = Effect.gen(function* () {
  const toolkit = yield* NlpToolkit;
  const exportedTools: ReadonlyArray<ExportedTool> = A.map(NlpTools, buildExportedTool(toolkit));
  yield* Obs.annotateNlpSpan({
    operation: "exportTools",
    tool_count: `${A.length(exportedTools)}`,
  });

  return exportedTools;
}).pipe(
  Obs.observeNlpWorkflow("nlp.tools.export", {
    operation: "exportTools",
    tool_count: `${A.length(NlpTools)}`,
  }),
  Effect.mapError((cause) =>
    ExportedToolError.fromCause(cause, "__init__", {
      message: `Failed to export NLP tools: ${renderError(cause)}`,
    })
  )
);
/**
 * Effect that exports every NLP toolkit tool as a positional descriptor.
 *
 * **Details**
 *
 * Use this adapter when an integration cannot call Effect AI toolkit handlers
 * directly and instead needs ordered argument names, JSON schemas, timeouts,
 * usage snippets, and a single Effectful handler per tool.
 *
 * **Example** (List exported tool names)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { exportTools } from "@beep/nlp-processing/Tools/ToolExport"
 * import { WinkNlpToolkitLive } from "@beep/wink"
 *
 * const toolNames = await Effect.runPromise(
 *   exportTools.pipe(
 *     Effect.map((tools) => tools.map((tool) => tool.name)),
 *     Effect.provide(WinkNlpToolkitLive)
 *   )
 * )
 *
 * toolNames.includes("Tokenize")
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export const exportTools: typeof exportToolsEffect = exportToolsEffect;
