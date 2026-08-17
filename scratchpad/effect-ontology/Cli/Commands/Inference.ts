/**
 * CLI Command: Inference
 *
 * **Details**
 *
 * Run RDFS inference on a local Turtle file.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as Struct from "@beep/utils/Struct";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag"
import { ErrorMessage, OptionalErrorCause } from "../../Domain/Error/Base.ts";
import { RdfBuilder, rdfStoreAddQuad, rdfStoreSize } from "../../Service/Rdf.ts";
import { Reasoner, ReasoningConfig } from "../../Service/Reasoner.ts";
import { computeQuadDelta, summarizeDelta } from "../../Utils/QuadDelta.ts";
import { withErrorHandler } from "../ErrorHandler.ts";

const $I = $ScratchpadId.create("effect-ontology/Cli/Commands/Inference");

// =============================================================================
// Options
// =============================================================================

const inputOption = Flag.file("input").pipe(
  Flag.withAlias("i"),
  Flag.withDescription("Input Turtle file path")
);

const outputOption = Flag.string("output").pipe(
  Flag.withAlias("o"),
  Flag.withDefault("./output-enriched.ttl"),
  Flag.withDescription("Output file path for enriched graph")
);

const profileOption = Flag.choice("profile", ["rdfs", "rdfs-subclass", "owl-sameas"]).pipe(
  Flag.withAlias("p"),
  Flag.withDefault("rdfs"),
  Flag.withDescription("Reasoning profile to apply")
);

const deltaOnlyOption = Flag.boolean("delta-only").pipe(
  Flag.withAlias("d"),
  Flag.withDefault(false),
  Flag.withDescription("Output only inferred triples (delta)")
);

// =============================================================================
// Command
// =============================================================================

const InferenceCliOperation = LiteralKit(["readInput", "writeOutput"]).pipe(
  $I.annoteSchema("InferenceCliOperation", {
    description: "Filesystem operation performed by the inference CLI.",
  })
);

class InferenceCliError extends S.TaggedError<InferenceCliError>($I`InferenceCliError`)(
  "InferenceCliError",
  {
    operation: InferenceCliOperation.annotateKey({
      description: "Inference CLI filesystem operation that failed.",
    }),
    message: ErrorMessage.annotateKey({
      description: "Human-readable inference CLI failure diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional filesystem defect raised by the inference CLI.",
    }),
  },
  $I.annote("InferenceCliError", {
    description: "Failure raised when the inference CLI cannot read input or write output.",
  })
) {}

/**
 * inference - Run RDFS inference on a Turtle file
 *
 * **Example** (Use inferenceCommand)
 *
 * ```ts
 * import { inferenceCommand } from "@effect-ontology/Cli/Commands/Inference"
 *
 * console.log(inferenceCommand)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
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
      const turtle = yield* fs.readFileString(input).pipe(
        Effect.mapError((cause) =>
          InferenceCliError.make({
            operation: "readInput",
            message: `Failed to read input file: ${cause.message}`,
            cause: O.some(cause),
          })
        )
      );

      // Parse input graph
      const originalStore = yield* rdfBuilder.parseTurtle(turtle);
      const originalCount = rdfStoreSize(originalStore);

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
      if (!A.isReadonlyArrayEmpty(Struct.keys(summary.predicateBreakdown))) {
        yield* Console.log(`\nBy predicate:`);
        for (const [pred, count] of Struct.entries(summary.predicateBreakdown)) {
          yield* Console.log(`  ${pred}: ${count}`);
        }
      }

      // Prepare output
      let outputStore = enrichedStore;
      if (deltaOnly) {
        outputStore = yield* rdfBuilder.createStore;
        for (const quad of delta.newQuads) {
          rdfStoreAddQuad(outputStore, quad);
        }
      }

      // Serialize and write output
      const outputTurtle = yield* rdfBuilder.toTurtle(outputStore);
      yield* fs.writeFileString(output, outputTurtle).pipe(
        Effect.mapError((cause) =>
          InferenceCliError.make({
            operation: "writeOutput",
            message: `Failed to write output file: ${cause.message}`,
            cause: O.some(cause),
          })
        )
      );

      yield* Console.log(`\n${Str.repeat(50)("=")}`);
      yield* Console.log(`Output written to: ${output}`);
      if (deltaOnly) {
        yield* Console.log(`(delta only - ${delta.newQuads.length} triples)`);
      } else {
        yield* Console.log(`(full graph - ${rdfStoreSize(enrichedStore)} triples)`);
      }
    }).pipe(withErrorHandler)
).pipe(Command.withDescription("Run RDFS inference on a Turtle file"));
