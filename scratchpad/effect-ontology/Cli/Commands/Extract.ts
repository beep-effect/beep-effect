/**
 * CLI: Extract Command
 *
 * **Details**
 *
 * Quick ad-hoc extraction testing without server setup.
 * Supports inline text, file input, or stdin.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import { Unknown } from "@beep/schema/Unknown";
import * as BunServices from "@effect/platform-bun/BunServices";
import { ConfigProvider, Console, Duration, Effect, FileSystem, Layer, Path } from "effect";
import type { Scope } from "effect/Scope";
import { PlatformError } from "effect/PlatformError";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Args from "effect/unstable/cli/Argument";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";
import { ErrorMessage, OptionalErrorCause } from "../../Domain/Error/Base.ts";
import { ContentHash, Namespace, OntologyName } from "../../Domain/Identity.ts";
import { ChunkingConfig, LlmConfig, RunConfig } from "../../Domain/Model/ExtractionRun.ts";
import { OntologyRef } from "../../Domain/Model/Ontology.ts";
import { makeCliExtractionLayer } from "../../Runtime/WorkflowLayers.ts";
import { ExtractionWorkflow } from "../../Service/ExtractionWorkflow.ts";
import { RdfBuilder } from "../../Service/Rdf.ts";
import { withErrorHandler } from "../ErrorHandler.ts";
import type { ExtractionError } from "../../Domain/Error/Extraction.ts";
import type { RdfError, SerializationFailed } from "../../Domain/Error/Rdf.ts";


const $I = $ScratchpadId.create("effect-ontology/Cli/Commands/Extract");

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
  Flag.withDefault("json"),
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

class ExtractInputError extends S.TaggedError<ExtractInputError>($I`ExtractInputError`)(
  "ExtractInputError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable diagnostic for invalid or unavailable extraction input.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional defect raised while acquiring extraction input.",
    }),
  },
  $I.annote("ExtractInputError", {
    description: "Failure raised when the extract command cannot obtain usable text input.",
  })
) {}

/**
 * Read input text from various sources (inline, file, or stdin)
 */
const readInputText = Effect.fn("Extract.readInputText")(function* (
  textOpt: O.Option<string>,
  fileOpt: O.Option<string>
): Effect.fn.Return<string, ExtractInputError | PlatformError, FileSystem.FileSystem> {
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
    catch: (cause) => ExtractInputError.make({ message: "Failed to access stdin", cause: O.some(cause) }),
  });
  if (stdin.isTTY) {
    return yield* ExtractInputError.make({
      message: "No input provided. Use --text, --file, or pipe input via stdin.",
    });
  }

  const input = yield* Effect.callback<string, ExtractInputError>((resume) => {
    const chunks = A.empty<Buffer>();
    const onData = (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const onEnd = () => resume(Effect.succeed(Buffer.concat(chunks).toString("utf-8")));
    const onError = (cause: unknown) =>
      resume(Effect.fail(ExtractInputError.make({ message: "Failed to read stdin", cause: O.some(cause) })));
    stdin.on("data", onData);
    stdin.once("end", onEnd);
    stdin.once("error", onError);
    return Effect.sync(() => {
      stdin.off("data", onData);
      stdin.off("end", onEnd);
      stdin.off("error", onError);
    });
  });

  if (P.not(P.isTruthy)(Str.trim(input))) {
    return yield* ExtractInputError.make({
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
): Effect.fn.Return<void, ExtractInputError | ExtractionError | PlatformError | RdfError | S.SchemaError | SerializationFailed, ExtractionWorkflow | FileSystem.FileSystem | Path.Path | RdfBuilder | Scope> {
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
      overlapSentences: NonNegativeInt.make(2),
    }),
    llm: LlmConfig.make({
      model: "claude-haiku-4-5",
      temperature: 0.1,
      maxTokens: PosInt.make(4096),
      timeout: Duration.millis(60000),
    }),
    concurrency: PosInt.make(concurrency),
  });
  const workflow = yield* ExtractionWorkflow;
  const { graph } = yield* workflow.extract(inputText, runConfig);
  yield* Console.error(`\nExtracted: ${graph.entities.length} entities, ${graph.relations.length} relations`);
  if (format === "json") {
    const output = {
      entities: A.map(graph.entities, (e) => ({
        id: e.id,
        mention: e.mention,
        types: e.types,
        attributes: e.attributes,
      })),
      relations: A.map(graph.relations, (r) => ({
        subjectId: r.subjectId,
        predicate: r.predicate,
        object: r.object,
      })),
    };
    const outputJson = yield* Unknown.encodeUnknownEffectFromJsonString(output, { space: 2 });
    yield* Console.log(outputJson);
  } else {
    const rdf = yield* RdfBuilder;
    const store = yield* rdf.makeStore;
    yield* rdf.addEntities(store, graph.entities, { targetNamespace: "https://cli.example.org/data/" });
    yield* rdf.addRelations(store, graph.relations, { targetNamespace: "https://cli.example.org/data/" });
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

/**
 * Runs ad-hoc ontology-guided extraction from inline text, a file, or stdin
 * without starting the HTTP server.
 *
 * **Details**
 *
 * The positional `ontology` argument is a Turtle file. Supply `--text` /
 * `-t` for inline source, `--file` / `-f` for a document path, `--format`
 * `json|turtle`, and `--concurrency` for parallel chunk work.
 *
 * **Example** (Compose extract with ontology and inline text)
 *
 * ```ts
 * import { extractCommand } from "@effect-ontology/Cli/Commands/Extract"
 * import * as Command from "effect/unstable/cli/Command"
 *
 * const argv = ["ontologies/people.ttl", "--text", "Ada Lovelace was a mathematician"] as const
 * const program = Command.runWith(extractCommand, { version: "0.0.0" })([...argv])
 * console.log(extractCommand.name) // "extract"
 * console.log(argv.includes("--text")) // true
 * console.log(program !== extractCommand)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
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
