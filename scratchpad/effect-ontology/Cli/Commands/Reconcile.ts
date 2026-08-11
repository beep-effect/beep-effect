/**
 * CLI: Reconcile Command
 *
 * Analyze entities in a batch for potential duplicates and display statistics.
 * For full cross-batch resolution with persistent registry, use the API endpoint.
 *
 * @since 2.0.0
 * @module Cli/Commands/Reconcile
 */

import { Chunk, Console, Effect, FileSystem, Option, Schema } from "effect";
import { Command, Flag as Options } from "effect/unstable/cli";
import type { IRI, Literal } from "../../Domain/Rdf/Types.ts";
import { BatchManifest } from "../../Domain/Schema/Batch.ts";
import { RdfBuilder } from "../../Service/Rdf.ts";
import { StorageService } from "../../Service/Storage.ts";
import { withErrorHandler } from "../ErrorHandler.ts";

// =============================================================================
// Command Options
// =============================================================================

const batchIdOption = Options.string("batch-id").pipe(
  Options.withAlias("b"),
  Options.withDescription("Batch ID to analyze")
);

const manifestOption = Options.file("manifest").pipe(
  Options.withAlias("m"),
  Options.optional,
  Options.withDescription("Path to batch manifest JSON (alternative to batch-id)")
);

const thresholdOption = Options.float("threshold").pipe(
  Options.withAlias("t"),
  Options.withDefault(0.8),
  Options.withDescription("Similarity threshold for duplicate detection (0-1)")
);

const verboseOption = Options.boolean("verbose").pipe(
  Options.withAlias("v"),
  Options.withDefault(false),
  Options.withDescription("Show detailed entity information")
);

// =============================================================================
// Helpers
// =============================================================================

/**
 * Simple string similarity using normalized Levenshtein distance
 */
const stringSimilarity = (a: string, b: string): number => {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  if (aLower === bLower) return 1.0;
  if (aLower.length === 0 || bLower.length === 0) return 0.0;

  // Simple Jaccard similarity on character n-grams
  const ngrams = (s: string, n: number = 2): Set<string> => {
    const result = new Set<string>();
    for (let i = 0; i <= s.length - n; i++) {
      result.add(s.substring(i, i + n));
    }
    return result;
  };

  const aGrams = ngrams(aLower);
  const bGrams = ngrams(bLower);

  let intersection = 0;
  for (const gram of aGrams) {
    if (bGrams.has(gram)) intersection++;
  }

  const union = aGrams.size + bGrams.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

interface ExtractedEntity {
  readonly iri: string;
  readonly types: ReadonlyArray<string>;
  readonly label: string;
  readonly sourceDoc: string;
}

// =============================================================================
// Command Implementation
// =============================================================================

const reconcileHandler = Effect.fn("reconcileHandler")(function* (
  batchId: string,
  manifest: Option.Option<string>,
  threshold: number,
  verbose: boolean
) {
  const storage = yield* StorageService;
  const rdf = yield* RdfBuilder;
  yield* Console.log(`Analyzing entities for batch: ${batchId}`);
  yield* Console.log(`Similarity threshold: ${threshold}`);
  let manifestData: BatchManifest;
  if (Option.isSome(manifest)) {
    const fs = yield* FileSystem.FileSystem;
    const content = yield* fs.readFileString(manifest.value);
    manifestData = yield* Schema.decodeEffect(Schema.fromJsonString(BatchManifest))(content);
  } else {
    const manifestKey = `batches/${batchId}/manifest.json`;
    const contentOpt = yield* storage.get(manifestKey);
    if (contentOpt === undefined) {
      yield* Console.error(`Manifest not found: ${manifestKey}`);
      yield* Console.log("Use --manifest to specify a local manifest file");
      return;
    }
    manifestData = yield* Schema.decodeEffect(Schema.fromJsonString(BatchManifest))(contentOpt);
  }
  yield* Console.log(`Found ${manifestData.documents.length} documents in batch`);
  const allEntities: Array<ExtractedEntity> = [];
  for (const doc of manifestData.documents) {
    const graphKey = `batches/${batchId}/graphs/${doc.documentId}.ttl`;
    const graphContentOpt = yield* storage.get(graphKey);
    if (graphContentOpt === undefined) {
      if (verbose) {
        yield* Console.log(`  No graph found for: ${doc.documentId}`);
      }
      continue;
    }
    const store = yield* rdf.parseTurtle(graphContentOpt);
    const typeQuads = yield* rdf.queryStore(store, {
      predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type" as IRI,
    });
    const entityTypes = new Map<string, Set<string>>();
    for (const quad of typeQuads) {
      const iri = quad.subject;
      if (!iri.startsWith("_:")) {
        if (!entityTypes.has(iri)) {
          entityTypes.set(iri, new Set());
        }
        const typeIri = typeof quad.object === "string" ? quad.object : (quad.object as Literal).value;
        entityTypes.get(iri)!.add(typeIri);
      }
    }
    const rdfsLabelQuads = yield* rdf.queryStore(store, {
      predicate: "http://www.w3.org/2000/01/rdf-schema#label" as IRI,
    });
    const schemaNameQuads = yield* rdf.queryStore(store, {
      predicate: "http://schema.org/name" as IRI,
    });
    const entityLabels = new Map<string, string>();
    for (const quad of Chunk.toArray(rdfsLabelQuads).concat(Chunk.toArray(schemaNameQuads))) {
      const subject = quad.subject;
      if (!subject.startsWith("_:") && !entityLabels.has(subject)) {
        const label = typeof quad.object === "string" ? quad.object : (quad.object as Literal).value;
        entityLabels.set(subject, label);
      }
    }
    for (const [iri, types] of entityTypes) {
      const label = entityLabels.get(iri) ?? iri.split(/[#/]/).pop() ?? iri;
      allEntities.push({
        iri,
        types: Array.from(types),
        label,
        sourceDoc: doc.documentId,
      });
    }
    if (verbose) {
      yield* Console.log(`  ${doc.documentId}: ${entityTypes.size} entities`);
    }
  }
  yield* Console.log(`\nTotal entities found: ${allEntities.length}`);
  if (allEntities.length === 0) {
    yield* Console.log("No entities to analyze. Run extraction first.");
    return;
  }
  const duplicatePairs: Array<{
    entity1: ExtractedEntity;
    entity2: ExtractedEntity;
    similarity: number;
  }> = [];
  for (let i = 0; i < allEntities.length; i++) {
    for (let j = i + 1; j < allEntities.length; j++) {
      const e1 = allEntities[i];
      const e2 = allEntities[j];
      if (e1.iri === e2.iri) continue;
      const similarity = stringSimilarity(e1.label, e2.label);
      if (similarity >= threshold) {
        duplicatePairs.push({
          entity1: e1,
          entity2: e2,
          similarity,
        });
      }
    }
  }
  duplicatePairs.sort((a, b) => b.similarity - a.similarity);
  const uniqueInDuplicates = new Set<string>();
  for (const pair of duplicatePairs) {
    uniqueInDuplicates.add(pair.entity1.iri);
    uniqueInDuplicates.add(pair.entity2.iri);
  }
  yield* Console.log("\n--- Resolution Statistics ---");
  yield* Console.log(`Total entities: ${allEntities.length}`);
  yield* Console.log(`Potential duplicate pairs: ${duplicatePairs.length}`);
  yield* Console.log(`Entities involved in duplicates: ${uniqueInDuplicates.size}`);
  yield* Console.log(`Estimated unique entities: ${allEntities.length - Math.floor(uniqueInDuplicates.size / 2)}`);
  if (duplicatePairs.length > 0) {
    yield* Console.log("\n--- Top Potential Duplicates ---");
    const topPairs = duplicatePairs.slice(0, 10);
    for (const pair of topPairs) {
      yield* Console.log(
        `[${(pair.similarity * 100).toFixed(1)}%] "${pair.entity1.label}" <-> "${pair.entity2.label}"`
      );
      if (verbose) {
        yield* Console.log(`  Entity 1: ${pair.entity1.iri}`);
        yield* Console.log(`    Types: ${pair.entity1.types.join(", ")}`);
        yield* Console.log(`    Source: ${pair.entity1.sourceDoc}`);
        yield* Console.log(`  Entity 2: ${pair.entity2.iri}`);
        yield* Console.log(`    Types: ${pair.entity2.types.join(", ")}`);
        yield* Console.log(`    Source: ${pair.entity2.sourceDoc}`);
      }
    }
    if (duplicatePairs.length > 10) {
      yield* Console.log(`  ... and ${duplicatePairs.length - 10} more pairs`);
    }
  }
  const typeDistribution = new Map<string, number>();
  for (const entity of allEntities) {
    for (const type of entity.types) {
      const shortType = type.split(/[#/]/).pop() ?? type;
      typeDistribution.set(shortType, (typeDistribution.get(shortType) ?? 0) + 1);
    }
  }
  yield* Console.log("\n--- Entity Type Distribution ---");
  const sortedTypes = Array.from(typeDistribution.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [type, count] of sortedTypes) {
    yield* Console.log(`  ${type}: ${count}`);
  }
  const docDistribution = new Map<string, number>();
  for (const entity of allEntities) {
    docDistribution.set(entity.sourceDoc, (docDistribution.get(entity.sourceDoc) ?? 0) + 1);
  }
  yield* Console.log("\n--- Entities per Document ---");
  for (const [doc, count] of docDistribution) {
    yield* Console.log(`  ${doc}: ${count}`);
  }
});

// =============================================================================
// Command Definition
// =============================================================================

export const reconcileCommand = Command.make(
  "reconcile",
  {
    batchId: batchIdOption,
    manifest: manifestOption,
    threshold: thresholdOption,
    verbose: verboseOption,
  },
  ({ batchId, manifest, threshold, verbose }) =>
    withErrorHandler(reconcileHandler(batchId, manifest, threshold, verbose))
).pipe(Command.withDescription("Analyze entities in a batch for potential duplicates and display statistics"));
