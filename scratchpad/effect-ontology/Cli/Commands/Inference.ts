/**
 * CLI Command: Inference
 *
 * Run RDFS inference on a local Turtle file.
 *
 * @since 2.0.0
 * @module Cli/Commands/Inference
 */

import { Console, Data, Effect, FileSystem } from "effect";
import * as Str from "effect/String";
import { Command, Flag as Options } from "effect/unstable/cli";
import { RdfBuilder } from "../../Service/Rdf.ts";
import { Reasoner, ReasoningConfig } from "../../Service/Reasoner.ts";
import { computeQuadDelta, summarizeDelta } from "../../Utils/QuadDelta.ts";
import { withErrorHandler } from "../ErrorHandler.ts";

// =============================================================================
// Options
// =============================================================================

const inputOption = Options.file("input").pipe(
  Options.withAlias("i"),
  Options.withDescription("Input Turtle file path")
);

const outputOption = Options.string("output").pipe(
  Options.withAlias("o"),
  Options.withDefault("./output-enriched.ttl"),
  Options.withDescription("Output file path for enriched graph")
);

const profileOption = Options.choice("profile", ["rdfs", "rdfs-subclass", "owl-sameas"] as const).pipe(
  Options.withAlias("p"),
  Options.withDefault("rdfs" as const),
  Options.withDescription("Reasoning profile to apply")
);

const deltaOnlyOption = Options.boolean("delta-only").pipe(
  Options.withAlias("d"),
  Options.withDefault(false),
  Options.withDescription("Output only inferred triples (delta)")
);

// =============================================================================
// Command
// =============================================================================

class InferenceCliError extends Data.TaggedError("InferenceCliError")<{
  readonly operation: "readInput" | "writeOutput";
  readonly message: string;
  readonly cause: unknown;
}> {}

/**
 * inference - Run RDFS inference on a Turtle file
 *
 * @example
 * ```bash
 * effect-onto inference --input graph.ttl --output enriched.ttl --profile rdfs
 * effect-onto inference -i graph.ttl -d  # Output only delta
 * ```
 */
export const inferenceCommand = Command.make(
  "inference",
  { input: inputOption, output: outputOption, profile: profileOption, deltaOnly: deltaOnlyOption },
  ({ deltaOnly, input, output, profile }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const rdfBuilder = yield* RdfBuilder;
      const reasoner = yield* Reasoner;

      yield* Console.log(`Running ${profile} inference on ${input}...`);

      // Read input file
      const turtle = yield* fs
        .readFileString(input)
        .pipe(
          Effect.mapError(
            (cause) =>
              new InferenceCliError({
                operation: "readInput",
                message: `Failed to read input file: ${cause.message}`,
                cause,
              })
          )
        );

      // Parse input graph
      const originalStore = yield* rdfBuilder.parseTurtle(turtle);
      const originalCount = originalStore._store.size;

      yield* Console.log(`Parsed ${originalCount} triples from input`);

      // Run reasoning (creates a copy)
      const config = ReasoningConfig.make({ profile });
      const { result: reasoningResult, store: enrichedStore } = yield* reasoner.reasonCopy(originalStore, config);

      // Compute delta
      const delta = yield* computeQuadDelta(originalStore, enrichedStore);
      const summary = summarizeDelta(delta);

      // Display statistics
      yield* Console.log(`\n${Str.repeat(50)("=")}`);
      yield* Console.log("Inference Statistics");
      yield* Console.log(Str.repeat(50)("="));
      yield* Console.log(`  Original triples:  ${summary.originalTriples}`);
      yield* Console.log(`  Inferred triples:  ${summary.inferredTriples}`);
      yield* Console.log(`  Total triples:     ${summary.enrichedTriples}`);
      yield* Console.log(`  Inference ratio:   ${(summary.inferenceRatio * 100).toFixed(1)}%`);
      yield* Console.log(`  Duration:          ${reasoningResult.durationMs}ms`);

      // Show predicate breakdown if there are inferences
      if (Object.keys(summary.predicateBreakdown).length > 0) {
        yield* Console.log(`\nBy predicate:`);
        for (const [pred, count] of Object.entries(summary.predicateBreakdown)) {
          yield* Console.log(`  ${pred}: ${count}`);
        }
      }

      // Prepare output
      let outputStore = enrichedStore;
      if (deltaOnly) {
        outputStore = yield* rdfBuilder.createStore;
        for (const quad of delta.newQuads) {
          outputStore._store.addQuad(quad);
        }
      }

      // Serialize and write output
      const outputTurtle = yield* rdfBuilder.toTurtle(outputStore);
      yield* fs
        .writeFileString(output, outputTurtle)
        .pipe(
          Effect.mapError(
            (cause) =>
              new InferenceCliError({
                operation: "writeOutput",
                message: `Failed to write output file: ${cause.message}`,
                cause,
              })
          )
        );

      yield* Console.log(`\n${Str.repeat(50)("=")}`);
      yield* Console.log(`Output written to: ${output}`);
      if (deltaOnly) {
        yield* Console.log(`(delta only - ${delta.newQuads.length} triples)`);
      } else {
        yield* Console.log(`(full graph - ${enrichedStore._store.size} triples)`);
      }
    }).pipe(withErrorHandler)
).pipe(Command.withDescription("Run RDFS inference on a Turtle file"));
