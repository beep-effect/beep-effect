/**
 * CLI: Extract Command
 *
 * Quick ad-hoc extraction testing without server setup.
 * Supports inline text, file input, or stdin.
 *
 * @since 2.0.0
 * @module Cli/Commands/Extract
 */

import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Data from "effect/Data";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Args from "effect/unstable/cli/Argument";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";
import { ContentHash, Namespace, OntologyName } from "../../Domain/Identity.ts";
import { ChunkingConfig, LlmConfig, RunConfig } from "../../Domain/Model/ExtractionRun.ts";
import { OntologyRef } from "../../Domain/Model/Ontology.ts";
import { makeCliExtractionLayer } from "../../Runtime/WorkflowLayers.ts";
import { ExtractionWorkflow } from "../../Service/ExtractionWorkflow.ts";
import { RdfBuilder } from "../../Service/Rdf.ts";
import { withErrorHandler } from "../ErrorHandler.ts";

// =============================================================================
// Command Options
// =============================================================================

const ontologyArg = Args.file("ontology").pipe(Args.withDescription("Path to ontology file (Turtle)"));

const textOption = Flag.string("text").pipe(
  Flag.withAlias("t"),
  Flag.optional,
  Flag.withDescription("Inline text to extract from")
);

const fileOption = Flag.file("file").pipe(
  Flag.withAlias("f"),
  Flag.optional,
  Flag.withDescription("Path to file containing text to extract")
);

const noExternalVocabsOption = Flag.boolean("no-external-vocabs").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Skip loading external vocabularies (PROV-O, ORG, FOAF)")
);

const formatOption = Flag.choice("format", ["json", "turtle"]).pipe(
  Flag.withAlias("o"),
  Flag.withDefault("json" as const),
  Flag.withDescription("Output format: json (default) or turtle")
);

const concurrencyOption = Flag.integer("concurrency").pipe(
  Flag.withAlias("c"),
  Flag.withDefault(4),
  Flag.withDescription("Extraction concurrency (default: 4)")
);

// =============================================================================
// Helpers
// =============================================================================

class ExtractInputError extends Data.TaggedError("ExtractInputError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Read input text from various sources (inline, file, or stdin)
 */
const readInputText = Effect.fn("Extract.readInputText")(function* (
  textOpt: O.Option<string>,
  fileOpt: O.Option<string>
) {
  const fs = yield* FileSystem.FileSystem;

  // Priority: --text > --file > stdin
  if (O.isSome(textOpt)) {
    return textOpt.value;
  }

  if (O.isSome(fileOpt)) {
    return yield* fs.readFileString(fileOpt.value);
  }

  // Read from stdin
  const { stdin } = yield* Effect.tryPromise({
    try: () => import("node:process"),
    catch: (cause) => new ExtractInputError({ message: "Failed to access stdin", cause }),
  });
  if (stdin.isTTY) {
    return yield* new ExtractInputError({
      message: "No input provided. Use --text, --file, or pipe input via stdin.",
    });
  }

  const input = yield* Effect.callback<string, ExtractInputError>((resume) => {
    const chunks: Buffer[] = [];
    const onData = (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const onEnd = () => resume(Effect.succeed(Buffer.concat(chunks).toString("utf-8")));
    const onError = (cause: unknown) =>
      resume(Effect.fail(new ExtractInputError({ message: "Failed to read stdin", cause })));
    stdin.on("data", onData);
    stdin.once("end", onEnd);
    stdin.once("error", onError);
    return Effect.sync(() => {
      stdin.off("data", onData);
      stdin.off("end", onEnd);
      stdin.off("error", onError);
    });
  });

  if (P.not(P.isTruthy)(input.trim())) {
    return yield* new ExtractInputError({
      message: "No input provided. Use --text, --file, or pipe input via stdin.",
    });
  }

  return input;
});

/**
 * Create a content hash from text (for OntologyRef)
 */
const createContentHash = (content: string): string => {
  const hash = Bun.hash(content).toString(16).padStart(16, "0");
  return hash.slice(0, 16);
};

// =============================================================================
// Command Implementation
// =============================================================================

const extractHandler = Effect.fn("extractHandler")(function* (
  ontologyPath: string,
  text: O.Option<string>,
  file: O.Option<string>,
  noExternalVocabs: boolean,
  format: "json" | "turtle",
  concurrency: number
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const inputText = yield* readInputText(text, file);
  yield* Console.error(`Ontology: ${ontologyPath}`);
  yield* Console.error(`External vocabs: ${noExternalVocabs ? "disabled" : "enabled"}`);
  yield* Console.error(`Input: ${inputText.length} chars`);
  yield* Console.error(`Format: ${format}`);
  yield* Console.error(`Concurrency: ${concurrency}`);
  yield* Console.error("---");
  const ontologyContent = yield* fs.readFileString(ontologyPath);
  const contentHash = ContentHash.make(createContentHash(ontologyContent));
  const basename = path.basename(ontologyPath, ".ttl");
  const ontologyRef = OntologyRef.make({
    namespace: Namespace.make("cli"),
    name: OntologyName.make(basename),
    contentHash,
  });
  const runConfig = RunConfig.make({
    ontology: ontologyRef,
    chunking: ChunkingConfig.make({
      maxChunkSize: PosInt.make(2000),
      preserveSentences: true,
      overlapTokens: NonNegativeInt.make(50),
    }),
    llm: LlmConfig.make({
      model: "claude-haiku-4-5",
      temperature: 0.1,
      maxTokens: PosInt.make(4096),
      timeout: Duration.millis(60000),
    }),
    concurrency: PosInt.make(concurrency),
    enableGrounding: true,
  });
  const workflow = yield* ExtractionWorkflow;
  const graph = yield* workflow.extract(inputText, runConfig);
  yield* Console.error(`\nExtracted: ${graph.entities.length} entities, ${graph.relations.length} relations`);
  if (format === "json") {
    const output = {
      entities: graph.entities.map((e) => ({
        id: e.id,
        mention: e.mention,
        types: e.types,
        attributes: e.attributes,
      })),
      relations: graph.relations.map((r) => ({
        subjectId: r.subjectId,
        predicate: r.predicate,
        object: r.object,
      })),
    };
    const outputJson = yield* S.encodeUnknownEffect(S.fromJsonString(S.Unknown, { space: 2 }))(output);
    yield* Console.log(outputJson);
  } else {
    const rdf = yield* RdfBuilder;
    const store = yield* rdf.makeStore;
    yield* rdf.addEntities(store, graph.entities, { targetNamespace: "http://cli.example.org/data/" });
    yield* rdf.addRelations(store, graph.relations, { targetNamespace: "http://cli.example.org/data/" });
    const turtle = yield* rdf.toTurtle(store);
    yield* Console.log(turtle);
  }
});

// =============================================================================
// Layer Composition
// =============================================================================

/**
 * Create extraction layer with custom config overrides
 *
 * Uses makeCliExtractionLayer to build layer with custom ConfigProvider,
 * ensuring config overrides are applied BEFORE services are constructed.
 */
const makeExtractLayer = (ontologyPath: string, noExternalVocabs: boolean) => {
  // Create a config provider that checks our overrides first, then falls back to env
  const customConfigProvider = ConfigProvider.fromUnknown({
    ONTOLOGY_PATH: ontologyPath,
    ...(noExternalVocabs ? { ONTOLOGY_EXTERNAL_VOCABS_PATH: "__SKIP_EXTERNAL_VOCABS__" } : {}),
  }).pipe(ConfigProvider.orElse(ConfigProvider.fromEnv()));

  // Build extraction layer with custom config provider
  // This ensures config overrides are applied before any services are constructed
  return makeCliExtractionLayer(customConfigProvider).pipe(Layer.provideMerge(BunServices.layer));
};

// =============================================================================
// Command Definition
// =============================================================================

export const extractCommand = Command.make(
  "extract",
  {
    ontology: ontologyArg,
    text: textOption,
    file: fileOption,
    noExternalVocabs: noExternalVocabsOption,
    format: formatOption,
    concurrency: concurrencyOption,
  },
  ({ concurrency, file, format, noExternalVocabs, ontology, text }) =>
    withErrorHandler(
      makeExtractLayer(ontology, noExternalVocabs).pipe(
        Layer.build,
        Effect.flatMap((context) =>
          extractHandler(ontology, text, file, noExternalVocabs, format, concurrency).pipe(Effect.provide(context))
        ),
        Effect.scoped
      )
    )
).pipe(Command.withDescription("Extract knowledge graph from text using ontology-guided LLM prompting"));
