/**
 * CLI: Extract Command
 *
 * Quick ad-hoc extraction testing without server setup.
 * Supports inline text, file input, or stdin.
 *
 * @since 2.0.0
 * @module Cli/Commands/Extract
 */

import { Argument as Args, Command, Flag as Options } from "effect/unstable/cli"
import { FileSystem, Path } from "effect"
import { BunServices } from "@effect/platform-bun"
import { ConfigProvider, Console, Duration, Effect, Layer, Option } from "effect"
import { ChunkingConfig, LlmConfig, RunConfig } from "../../Domain/Model/ExtractionRun.ts"
import { OntologyRef } from "../../Domain/Model/Ontology.ts"
import { makeCliExtractionLayer } from "../../Runtime/WorkflowLayers.ts"
import { ExtractionWorkflow } from "../../Service/ExtractionWorkflow.ts"
import { RdfBuilder } from "../../Service/Rdf.ts"
import { withErrorHandler } from "../ErrorHandler.ts"

// =============================================================================
// Command Options
// =============================================================================

const ontologyArg = Args.file("ontology").pipe(
  Args.withDescription("Path to ontology file (Turtle)")
)

const textOption = Options.string("text").pipe(
  Options.withAlias("t"),
  Options.optional,
  Options.withDescription("Inline text to extract from")
)

const fileOption = Options.file("file").pipe(
  Options.withAlias("f"),
  Options.optional,
  Options.withDescription("Path to file containing text to extract")
)

const noExternalVocabsOption = Options.boolean("no-external-vocabs").pipe(
  Options.withDefault(false),
  Options.withDescription("Skip loading external vocabularies (PROV-O, ORG, FOAF)")
)

const formatOption = Options.choice("format", ["json", "turtle"]).pipe(
  Options.withAlias("o"),
  Options.withDefault("json" as const),
  Options.withDescription("Output format: json (default) or turtle")
)

const concurrencyOption = Options.integer("concurrency").pipe(
  Options.withAlias("c"),
  Options.withDefault(4),
  Options.withDescription("Extraction concurrency (default: 4)")
)

// =============================================================================
// Helpers
// =============================================================================

/**
 * Read input text from various sources (inline, file, or stdin)
 */
const readInputText = (
  textOpt: Option.Option<string>,
  fileOpt: Option.Option<string>
): Effect.Effect<string, Error, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem

    // Priority: --text > --file > stdin
    if (Option.isSome(textOpt)) {
      return textOpt.value
    }

    if (Option.isSome(fileOpt)) {
      return yield* fs.readFileString(fileOpt.value)
    }

    // Read from stdin
    const stdin = yield* Effect.tryPromise({
      try: async () => {
        // Check if stdin has data (non-blocking check)
        const { stdin } = await import("node:process")
        if (stdin.isTTY) {
          throw new Error("No input provided. Use --text, --file, or pipe input via stdin.")
        }

        // Read all stdin
        const chunks: Buffer[] = []
        for await (const chunk of stdin) {
          chunks.push(chunk as Buffer)
        }
        return Buffer.concat(chunks).toString("utf-8")
      },
      catch: (error) => new Error(`Failed to read stdin: ${error}`)
    })

    if (!stdin.trim()) {
      return yield* Effect.fail(new Error("No input provided. Use --text, --file, or pipe input via stdin."))
    }

    return stdin
  })

/**
 * Create a content hash from text (for OntologyRef)
 */
const createContentHash = (content: string): string => {
  const hash = Bun.hash(content).toString(16).padStart(16, "0")
  return hash.slice(0, 16)
}

// =============================================================================
// Command Implementation
// =============================================================================

const extractHandler = (
  ontologyPath: string,
  text: Option.Option<string>,
  file: Option.Option<string>,
  noExternalVocabs: boolean,
  format: "json" | "turtle",
  concurrency: number
) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    // Read input text
    const inputText = yield* readInputText(text, file)

    yield* Console.error(`Ontology: ${ontologyPath}`)
    yield* Console.error(`External vocabs: ${noExternalVocabs ? "disabled" : "enabled"}`)
    yield* Console.error(`Input: ${inputText.length} chars`)
    yield* Console.error(`Format: ${format}`)
    yield* Console.error(`Concurrency: ${concurrency}`)
    yield* Console.error("---")

    // Read ontology content for hash
    const ontologyContent = yield* fs.readFileString(ontologyPath)
    const contentHash = createContentHash(ontologyContent) as OntologyRef["contentHash"]

    // Extract name from filename
    const basename = path.basename(ontologyPath, ".ttl")

    // Build OntologyRef
    const ontologyRef = OntologyRef.make({
      namespace: "cli" as OntologyRef["namespace"],
      name: basename as OntologyRef["name"],
      contentHash
    })

    // Build RunConfig with defaults
    const runConfig = RunConfig.make({
      ontology: ontologyRef,
      chunking: ChunkingConfig.make({
        maxChunkSize: 2000,
        preserveSentences: true,
        overlapTokens: 50
      }),
      llm: LlmConfig.make({
        model: "claude-haiku-4-5",
        temperature: 0.1,
        maxTokens: 4096,
        timeout: Duration.millis(60_000)
      }),
      concurrency,
      enableGrounding: true
    })

    // Run extraction
    const workflow = yield* ExtractionWorkflow
    const graph = yield* workflow.extract(inputText, runConfig)

    yield* Console.error(`\nExtracted: ${graph.entities.length} entities, ${graph.relations.length} relations`)

    // Output results
    if (format === "json") {
      const output = {
        entities: graph.entities.map((e) => ({
          id: e.id,
          mention: e.mention,
          types: e.types,
          attributes: e.attributes
        })),
        relations: graph.relations.map((r) => ({
          subjectId: r.subjectId,
          predicate: r.predicate,
          object: r.object
        }))
      }
      yield* Console.log(JSON.stringify(output, null, 2))
    } else {
      // Turtle format - build RDF store and serialize
      const rdf = yield* RdfBuilder
      const store = yield* rdf.makeStore
      yield* rdf.addEntities(store, graph.entities, { targetNamespace: "http://cli.example.org/data/" })
      yield* rdf.addRelations(store, graph.relations, { targetNamespace: "http://cli.example.org/data/" })
      const turtle = yield* rdf.toTurtle(store)
      yield* Console.log(turtle)
    }
  })

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
    ...(noExternalVocabs
      ? { ONTOLOGY_EXTERNAL_VOCABS_PATH: "__SKIP_EXTERNAL_VOCABS__" }
      : {})
  }).pipe(
    ConfigProvider.orElse(ConfigProvider.fromEnv())
  )

  // Build extraction layer with custom config provider
  // This ensures config overrides are applied before any services are constructed
  return makeCliExtractionLayer(customConfigProvider).pipe(
    Layer.provideMerge(BunServices.layer)
  )
}

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
    concurrency: concurrencyOption
  },
  ({ concurrency, file, format, noExternalVocabs, ontology, text }) =>
    withErrorHandler(
      extractHandler(ontology, text, file, noExternalVocabs, format, concurrency).pipe(
        Effect.scoped,
        Effect.provide(makeExtractLayer(ontology, noExternalVocabs))
      )
    )
).pipe(
  Command.withDescription("Extract knowledge graph from text using ontology-guided LLM prompting")
)
