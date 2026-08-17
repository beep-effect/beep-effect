/**
 * CLI: Link Command
 *
 * **Details**
 *
 * Create owl:sameAs links between local entities and Wikidata entities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {IRI} from "@beep/rdf/Iri";
import {PosInt} from "@beep/schema/Int";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Result from "effect/Result";
import * as Console from "effect/Console";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";
import {RdfBuilder} from "../../Service/Rdf.ts";
import {WikidataClient} from "../../Service/WikidataClient.ts";
import {withErrorHandler} from "../ErrorHandler.ts";

// =============================================================================
// Command Options
// =============================================================================

const entityIriOption = Flag.string("entity-id").pipe(
  Flag.withAlias("e"),
  Flag.withDescription("Entity IRI to link")
);

const wikidataIdOption = Flag.string("wikidata-id").pipe(
  Flag.withAlias("w"),
  Flag.withDescription("Wikidata Q-ID (e.g., Q42)")
);

const graphOption = Flag.file("graph").pipe(
  Flag.withAlias("g"),
  Flag.optional,
  Flag.withDescription("RDF graph file to add the link to (Turtle)")
);

const outputOption = Flag.file("output").pipe(
  Flag.withAlias("o"),
  Flag.optional,
  Flag.withDescription("Output file for updated graph (default: stdout)")
);

const searchOption = Flag.string("search").pipe(
  Flag.withAlias("s"),
  Flag.optional,
  Flag.withDescription("Search Wikidata for candidates instead of linking")
);

const limitOption = Flag.integer("limit").pipe(
  Flag.withAlias("l"),
  Flag.withDefault(10),
  Flag.withDescription("Maximum search results (default: 10)")
);

const dryRunOption = Flag.boolean("dry-run").pipe(
  Flag.withAlias("n"),
  Flag.withDefault(false),
  Flag.withDescription("Validate without creating the link")
);

// =============================================================================
// Command Implementation
// =============================================================================

const linkHandler = Effect.fn("linkHandler")(function* (
  entityIri: string,
  wikidataId: string,
  graph: O.Option<string>,
  output: O.Option<string>,
  search: O.Option<string>,
  limit: number,
  dryRun: boolean
) {
  const wikidata = yield* WikidataClient;
  const rdf = yield* RdfBuilder;
  if (O.isSome(search)) {
    yield* Console.log(`Searching Wikidata for: "${search.value}"`);
    yield* Console.log("");
    const candidates = yield* wikidata.searchEntities(search.value, {limit: PosInt.make(limit)});
    if (A.isReadonlyArrayEmpty(candidates)) {
      yield* Console.log("No candidates found.");
      return;
    }
    yield* Console.log(`Found ${candidates.length} candidates:\n`);
    for (const candidate of candidates) {
      yield* Console.log(`  [${candidate.score.toFixed(0).padStart(3)}] ${candidate.qid}: ${candidate.label}`);
      if (O.isSome(candidate.description)) {
        yield* Console.log(`        ${candidate.description}`);
      }
      yield* Console.log(`        ${candidate.conceptUri}`);
      yield* Console.log("");
    }
    yield* Console.log(`
To create a link, run:`);
    yield* Console.log(
      `  effect-onto link --entity-id <YOUR_ENTITY_IRI> --wikidata-id ${candidates[0]?.qid ?? "<Q-ID>"}`
    );
    return;
  }
  if (!wikidata.validateQid(wikidataId)) {
    yield* Console.error(`Invalid Wikidata Q-ID format: ${wikidataId}`);
    yield* Console.log("Q-IDs should match the pattern: Q followed by digits (e.g., Q42)");
    return;
  }
  const entityIriResult = IRI.decodeResult(entityIri);
  if (Result.isFailure(entityIriResult)) {
    yield* Console.error(`Invalid entity IRI: ${entityIri}`);
    return;
  }
  yield* Console.log(`Verifying Wikidata entity: ${wikidataId}`);
  const wikidataEntity = yield* wikidata.getEntity(wikidataId);
  if (O.isNone(wikidataEntity)) {
    yield* Console.error(`Wikidata entity not found: ${wikidataId}`);
    return;
  }
  yield* Console.log(`  Found: ${wikidataEntity.value.label}`);
  if (O.isSome(wikidataEntity.value.description)) {
    yield* Console.log(`  Description: ${wikidataEntity.value.description.value}`);
  }
  yield* Console.log(`  URI: ${wikidataEntity.value.conceptUri}`);
  yield* Console.log("");
  if (dryRun) {
    yield* Console.log("Dry run - link not created");
    yield* Console.log(`Would create owl:sameAs link:`);
    yield* Console.log(`  ${entityIri} owl:sameAs ${wikidataEntity.value.conceptUri}`);
    return;
  }
  const sameAsTriple = `
@prefix owl: <https://www.w3.org/2002/07/owl#> .

<${entityIri}> owl:sameAs <${wikidataEntity.value.conceptUri}> .
`;
  if (O.isSome(graph)) {
    const fs = yield* FileSystem.FileSystem;
    const graphContent = yield* fs.readFileString(graph.value);
    const store = yield* rdf.parseTurtle(graphContent);
    yield* rdf.addSameAsLinks(store, {
      [entityIri]: wikidataEntity.value.conceptUri,
    });
    const updatedGraph = yield* rdf.toTurtle(store);
    if (O.isSome(output)) {
      yield* fs.writeFileString(output.value, updatedGraph);
      yield* Console.log(`Updated graph written to: ${output.value}`);
    } else {
      yield* Console.log("\n--- Updated Graph ---");
      yield* Console.log(updatedGraph);
    }
  } else {
    if (O.isSome(output)) {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString(output.value, Str.trim(sameAsTriple));
      yield* Console.log(`Link written to: ${output.value}`);
    } else {
      yield* Console.log("Created owl:sameAs link:");
      yield* Console.log(sameAsTriple);
    }
  }
  yield* Console.log(`\nSuccessfully linked ${entityIri} to ${wikidataId}`);
});

// =============================================================================
// Command Definition
// =============================================================================

/**
 * Exposes link command for composition by callers of this module.
 *
 * **Example** (Inspect link command)
 *
 * ```ts
 * import { linkCommand } from "@effect-ontology/Cli/Commands/Link"
 *
 * console.log(linkCommand)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const linkCommand = Command.make(
  "link",
  {
    dryRun: dryRunOption,
    entityIri: entityIriOption,
    graph: graphOption,
    limit: limitOption,
    output: outputOption,
    search: searchOption,
    wikidataId: wikidataIdOption,
  },
  ({dryRun, entityIri, graph, limit, output, search, wikidataId}) =>
    withErrorHandler(linkHandler(entityIri, wikidataId, graph, output, search, limit, dryRun))
).pipe(Command.withDescription("Create owl:sameAs links between local entities and Wikidata"));
