/**
 * CLI: Reconcile Command
 *
 * **Details**
 *
 * Analyze entities in a batch for potential duplicates and display statistics.
 * For full cross-batch resolution with persistent registry, use the API endpoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Subject } from "@beep/rdf";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_LABEL } from "@beep/rdf/Vocab/Rdfs";
import { SCHEMA_NAME } from "@beep/rdf/Vocab/SchemaOrg";
import { Chunk, Console, Effect, FileSystem, MutableHashMap, MutableHashSet, Order } from "effect";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { Command, Flag } from "effect/unstable/cli";
import { BatchManifest } from "../../Domain/Schema/Batch.ts";
import { RdfBuilder } from "../../Service/Rdf.ts";
import { StorageService } from "../../Service/Storage.ts";
import { withErrorHandler } from "../ErrorHandler.ts";
import * as S from "effect/Schema";
import type { ParsingFailed, RdfError } from "../../Domain/Error/Rdf.ts";
import * as PlatformError from "effect/PlatformError";
import type { KeyValueStoreError } from "effect/unstable/persistence/KeyValueStore";

// =============================================================================
// Command Options
// =============================================================================

const batchIdOption = Flag.string("batch-id").pipe(Flag.withAlias("b"), Flag.withDescription("Batch ID to analyze"));
const TypeCountOrder = Order.mapInput(Order.flip(Order.Number), (entry: readonly [string, number]) => entry[1]);

const manifestOption = Flag.file("manifest").pipe(
  Flag.withAlias("m"),
  Flag.optional,
  Flag.withDescription("Path to batch manifest JSON (alternative to batch-id)")
);

const thresholdOption = Flag.float("threshold").pipe(
  Flag.withAlias("t"),
  Flag.withDefault(0.8),
  Flag.withDescription("Similarity threshold for duplicate detection (0-1)")
);

const verboseOption = Flag.boolean("verbose").pipe(
  Flag.withAlias("v"),
  Flag.withDefault(false),
  Flag.withDescription("Show detailed entity information")
);

// =============================================================================
// Helpers
// =============================================================================

/**
 * Simple string similarity using normalized Levenshtein distance
 */
const stringSimilarity = (a: string, b: string): number => {
  const aLower = pipe(a, Str.toLowerCase, Str.trim);
  const bLower = pipe(b, Str.toLowerCase, Str.trim);

  if (aLower === bLower) return 1.0;
  if (Str.isEmpty(aLower) || Str.isEmpty(bLower)) return 0.0;

  // Simple Jaccard similarity on character n-grams
  const ngrams = (s: string, n: number = 2): MutableHashSet.MutableHashSet<string> => {
    const result = MutableHashSet.empty<string>();
    for (let i = 0; i <= s.length - n; i++) {
      MutableHashSet.add(result, Str.substring(i, i + n)(s));
    }
    return result;
  };

  const aGrams = ngrams(aLower);
  const bGrams = ngrams(bLower);

  let intersection = 0;
  for (const gram of aGrams) {
    if (MutableHashSet.has(bGrams, gram)) intersection++;
  }

  const union = MutableHashSet.size(aGrams) + MutableHashSet.size(bGrams) - intersection;
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
  manifest: O.Option<string>,
  threshold: number,
  verbose: boolean
): Effect.fn.Return<void, KeyValueStoreError | ParsingFailed | PlatformError.PlatformError | RdfError | S.SchemaError, FileSystem.FileSystem | RdfBuilder | StorageService> {
  const storage = yield* StorageService;
  const rdf = yield* RdfBuilder;
  yield* Console.log(`Analyzing entities for batch: ${batchId}`);
  yield* Console.log(`Similarity threshold: ${threshold}`);
  let manifestData: BatchManifest;
  if (O.isSome(manifest)) {
    const fs = yield* FileSystem.FileSystem;
    const content = yield* fs.readFileString(manifest.value);
    manifestData = yield* BatchManifest.decodeEffectFromJsonString(content);
  } else {
    const manifestKey = `batches/${batchId}/manifest.json`;
    const contentOpt = yield* storage.getOption(manifestKey);
    if (O.isNone(contentOpt)) {
      yield* Console.error(`Manifest not found: ${manifestKey}`);
      yield* Console.log("Use --manifest to specify a local manifest file");
      return;
    }
    manifestData = yield* BatchManifest.decodeEffectFromJsonString(contentOpt.value);
  }
  yield* Console.log(`Found ${manifestData.documents.length} documents in batch`);
  const allEntities: Array<ExtractedEntity> = [];
  for (const doc of manifestData.documents) {
    const graphKey = `batches/${batchId}/graphs/${doc.documentId}.ttl`;
    const graphContentOpt = yield* storage.getOption(graphKey);
    if (O.isNone(graphContentOpt)) {
      if (verbose) {
        yield* Console.log(`  No graph found for: ${doc.documentId}`);
      }
      continue;
    }
    const store = yield* rdf.parseTurtle(graphContentOpt.value);
    const typeQuads = yield* rdf.queryStore(store, {
      predicate: RDF_TYPE,
    });
    const entityTypes = MutableHashMap.empty<string, MutableHashSet.MutableHashSet<string>>();
    for (const quad of typeQuads) {
      if (Subject.guards.NamedNode(quad.subject)) {
        const iri = quad.subject.value;
        const types = O.getOrElse(MutableHashMap.get(entityTypes, iri), () => {
          const created = MutableHashSet.empty<string>();
          MutableHashMap.set(entityTypes, iri, created);
          return created;
        });
        const typeIri = quad.object.value;
        MutableHashSet.add(types, typeIri);
      }
    }
    const rdfsLabelQuads = yield* rdf.queryStore(store, {
      predicate: RDFS_LABEL,
    });
    const schemaNameQuads = yield* rdf.queryStore(store, {
      predicate: SCHEMA_NAME,
    });
    const entityLabels = MutableHashMap.empty<string, string>();
    for (const quad of Chunk.toArray(rdfsLabelQuads).concat(Chunk.toArray(schemaNameQuads))) {
      if (Subject.guards.NamedNode(quad.subject) && !MutableHashMap.has(entityLabels, quad.subject.value)) {
        const subject = quad.subject.value;
        const label = quad.object.value;
        MutableHashMap.set(entityLabels, subject, label);
      }
    }
    for (const [iri, types] of entityTypes) {
      const label = O.getOrElse(MutableHashMap.get(entityLabels, iri), () =>
        O.getOrElse(A.last(Str.split(/[#/]/)(iri)), () => iri)
      );
      allEntities.push({
        iri,
        types: A.fromIterable(types),
        label,
        sourceDoc: doc.documentId,
      });
    }
    if (verbose) {
      yield* Console.log(`  ${doc.documentId}: ${MutableHashMap.size(entityTypes)} entities`);
    }
  }
  yield* Console.log(`\nTotal entities found: ${allEntities.length}`);
  if (A.isReadonlyArrayEmpty(allEntities)) {
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
  const sortedDuplicatePairs = A.sort(
    duplicatePairs,
    Order.mapInput(Order.flip(Order.Number), (pair: (typeof duplicatePairs)[number]) => pair.similarity)
  );
  const uniqueInDuplicates = MutableHashSet.empty<string>();
  for (const pair of sortedDuplicatePairs) {
    MutableHashSet.add(uniqueInDuplicates, pair.entity1.iri);
    MutableHashSet.add(uniqueInDuplicates, pair.entity2.iri);
  }
  yield* Console.log("\n--- Resolution Statistics ---");
  yield* Console.log(`Total entities: ${allEntities.length}`);
  yield* Console.log(`Potential duplicate pairs: ${duplicatePairs.length}`);
  yield* Console.log(`Entities involved in duplicates: ${MutableHashSet.size(uniqueInDuplicates)}`);
  yield* Console.log(
    `Estimated unique entities: ${allEntities.length - Math.floor(MutableHashSet.size(uniqueInDuplicates) / 2)}`
  );
  if (duplicatePairs.length > 0) {
    yield* Console.log("\n--- Top Potential Duplicates ---");
    const topPairs = A.take(sortedDuplicatePairs, 10);
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
  const typeDistribution = MutableHashMap.empty<string, number>();
  for (const entity of allEntities) {
    for (const type of entity.types) {
      const shortType = O.getOrElse(A.last(Str.split(/[#/]/)(type)), () => type);
      MutableHashMap.set(
        typeDistribution,
        shortType,
        O.getOrElse(MutableHashMap.get(typeDistribution, shortType), () => 0) + 1
      );
    }
  }
  yield* Console.log("\n--- Entity Type Distribution ---");
  const sortedTypes = A.take(A.sort(A.fromIterable(typeDistribution), TypeCountOrder), 10);
  for (const [type, count] of sortedTypes) {
    yield* Console.log(`  ${type}: ${count}`);
  }
  const docDistribution = MutableHashMap.empty<string, number>();
  for (const entity of allEntities) {
    MutableHashMap.set(
      docDistribution,
      entity.sourceDoc,
      O.getOrElse(MutableHashMap.get(docDistribution, entity.sourceDoc), () => 0) + 1
    );
  }
  yield* Console.log("\n--- Entities per Document ---");
  for (const [doc, count] of docDistribution) {
    yield* Console.log(`  ${doc}: ${count}`);
  }
});

// =============================================================================
// Command Definition
// =============================================================================

/**
 * Exposes reconcile command for composition by callers of this module.
 *
 * **Example** (Inspect reconcile command)
 *
 * ```ts
 * import { reconcileCommand } from "@effect-ontology/Cli/Commands/Reconcile"
 *
 * console.log(reconcileCommand)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
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
