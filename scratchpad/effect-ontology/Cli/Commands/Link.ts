/**
 * CLI: Link Command
 *
 * Create owl:sameAs links between local entities and Wikidata entities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRI } from "@beep/rdf";
import { Console, Effect, FileSystem } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Command, Flag as Options } from "effect/unstable/cli";
import { RdfBuilder } from "../../Service/Rdf.ts";
import { WikidataClient } from "../../Service/WikidataClient.ts";
import { withErrorHandler } from "../ErrorHandler.ts";

// =============================================================================
// Command Options
// =============================================================================

const entityIriOption = Options.string("entity-id").pipe(
  Options.withAlias("e"),
  Options.withDescription("Entity IRI to link")
);

const wikidataIdOption = Options.string("wikidata-id").pipe(
  Options.withAlias("w"),
  Options.withDescription("Wikidata Q-ID (e.g., Q42)")
);

const graphOption = Options.file("graph").pipe(
  Options.withAlias("g"),
  Options.optional,
  Options.withDescription("RDF graph file to add the link to (Turtle)")
);

const outputOption = Options.file("output").pipe(
  Options.withAlias("o"),
  Options.optional,
  Options.withDescription("Output file for updated graph (default: stdout)")
);

const searchOption = Options.string("search").pipe(
  Options.withAlias("s"),
  Options.optional,
  Options.withDescription("Search Wikidata for candidates instead of linking")
);

const limitOption = Options.integer("limit").pipe(
  Options.withAlias("l"),
  Options.withDefault(10),
  Options.withDescription("Maximum search results (default: 10)")
);

const dryRunOption = Options.boolean("dry-run").pipe(
  Options.withAlias("n"),
  Options.withDefault(false),
  Options.withDescription("Validate without creating the link")
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
    const candidates = yield* wikidata.searchEntities(search.value, { limit });
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
  const entityIriResult = S.decodeResult(IRI)(entityIri);
  if (entityIriResult._tag === "Failure") {
    yield* Console.error(`Invalid entity IRI: ${entityIri}`);
    return;
  }
  yield* Console.log(`Verifying Wikidata entity: ${wikidataId}`);
  const wikidataEntity = yield* wikidata.getEntity(wikidataId);
  if (P.isNull(wikidataEntity)) {
    yield* Console.error(`Wikidata entity not found: ${wikidataId}`);
    return;
  }
  yield* Console.log(`  Found: ${wikidataEntity.label}`);
  if (O.isSome(wikidataEntity.description)) {
    yield* Console.log(`  Description: ${wikidataEntity.description}`);
  }
  yield* Console.log(`  URI: ${wikidataEntity.conceptUri}`);
  yield* Console.log("");
  if (dryRun) {
    yield* Console.log("Dry run - link not created");
    yield* Console.log(`Would create owl:sameAs link:`);
    yield* Console.log(`  ${entityIri} owl:sameAs ${wikidataEntity.conceptUri}`);
    return;
  }
  const sameAsTriple = `
@prefix owl: <http://www.w3.org/2002/07/owl#> .

<${entityIri}> owl:sameAs <${wikidataEntity.conceptUri}> .
`;
  if (O.isSome(graph)) {
    const fs = yield* FileSystem.FileSystem;
    const graphContent = yield* fs.readFileString(graph.value);
    const store = yield* rdf.parseTurtle(graphContent);
    yield* rdf.addSameAsLinks(store, {
      [entityIri]: wikidataEntity.conceptUri,
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
      yield* fs.writeFileString(output.value, sameAsTriple.trim());
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
  ({ dryRun, entityIri, graph, limit, output, search, wikidataId }) =>
    withErrorHandler(linkHandler(entityIri, wikidataId, graph, output, search, limit, dryRun))
).pipe(Command.withDescription("Create owl:sameAs links between local entities and Wikidata"));
