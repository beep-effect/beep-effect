/**
 * Service: Ontology Services
 *
 * Production-ready ontology loading using RdfService abstraction.
 * Parses OWL/RDFS ontologies and exposes classes and properties.
 * Backend-agnostic: works with any RDF engine via RdfService.
 *
 * @since 2.0.0
 * @module Service/Ontology
 */

import {createHash} from "node:crypto";
import {$ScratchpadId} from "@beep/identity";
import {
  Chunk,
  Context,
  Duration,
  Effect,
  HashMap,
  Layer,
  Option,
  Ref
} from "effect";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import {
  OntologyFileNotFound,
  OntologyParsingFailed
} from "../Domain/Error/Ontology.ts";
import type {RdfError} from "../Domain/Error/Rdf.ts";
import type {OntologyVersion} from "../Domain/Identity.ts";
import {
  ClassDefinition,
  OntologyContext,
  PropertyDefinition
} from "../Domain/Model/Ontology.ts";
import type {OntologyEmbeddings} from "../Domain/Model/OntologyEmbeddings.ts";
import {
  OWL,
  OWL_CLASS,
  OWL_DATATYPE_PROPERTY,
  OWL_EQUIVALENT_CLASS,
  OWL_FUNCTIONAL_PROPERTY,
  OWL_INVERSEOF,
  OWL_OBJECT_PROPERTY,
  RDF,
  RDF_TYPE,
  RDFS_COMMENT,
  RDFS_DOMAIN,
  RDFS_LABEL,
  RDFS_RANGE,
  RDFS_SUBCLASSOF,
  RDFS_SUBPROPERTYOF,
  SKOS_ALTLABEL,
  SKOS_BROADER,
  SKOS_CLOSEMATCH,
  SKOS_DEFINITION,
  SKOS_EXACTMATCH,
  SKOS_EXAMPLE,
  SKOS_HIDDENLABEL,
  SKOS_NARROWER,
  SKOS_PREFLABEL,
  SKOS_RELATED,
  SKOS_SCOPENOTE,
} from "../Domain/Rdf/Constants.ts";
import type {Quad} from "../Domain/Rdf/Types.ts";
import {IRI, Literal} from "../Domain/Rdf/Types.ts";
import type {OntologyEntry} from "../Domain/Schema/OntologyRegistry.ts";
import {rrfFusion} from "../Utils/Retrieval.ts";
import {ConfigService} from "./Config.ts";
import {NlpService} from "./Nlp.ts";
import {OntologyRegistryService} from "./OntologyRegistry.ts";
import type {RdfBuilderShape, RdfStore} from "./Rdf.ts";
import {RdfBuilder} from "./Rdf.ts";
import {StorageService, type StorageServiceMethods} from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Ontology");

/**
 * Load and merge external vocabularies into an RDF store
 *
 * Attempts to load external vocabularies (FOAF, PROV-O, W3C ORG, etc.) and
 * merge them into the provided store. Gracefully handles loading/parsing failures
 * by logging warnings and continuing with the main ontology only.
 *
 * @param mainStore - RDF store to merge external vocabularies into
 * @param externalPath - Storage path to external vocabularies file
 * @param contextLabel - Label for logging context (e.g., "main", "uri", "entry")
 * @param contextId - Optional context identifier for logging (e.g., URI or entry ID)
 * @returns Effect that completes after merge attempt
 *
 * @internal
 */
const loadAndMergeExternalVocabularies = Effect.fn("loadAndMergeExternalVocabularies")(function* (
  mainStore: RdfStore,
  externalPath: string,
  contextLabel: string,
  contextId: string | undefined,
  storage: StorageServiceMethods,
  rdf: RdfBuilderShape
) {
  const storageService = storage;
  const rdfBuilder = rdf;
  const externalContentOpt = yield* storageService.get(externalPath).pipe(
    Effect.catch((error) =>
      Effect.gen(function* () {
        const logContext = P.isNotUndefined(contextId)
          ? {[contextLabel]: contextId, path: externalPath}
          : {path: externalPath};
        yield* Effect.logWarning("Failed to load external vocabularies, continuing with main ontology only", {
          ...logContext,
          error: String(error),
        });
        return undefined;
      })
    )
  );
  if (externalContentOpt !== undefined) {
    const externalStore = yield* rdfBuilder.parseTurtle(externalContentOpt).pipe(
      Effect.catch((error) =>
        Effect.gen(function* () {
          const logContext = P.isNotUndefined(contextId)
            ? {[contextLabel]: contextId, path: externalPath}
            : {path: externalPath};
          yield* Effect.logWarning("Failed to parse external vocabularies, continuing with main ontology only", {
            ...logContext,
            error: String(error),
          });
          return yield* rdfBuilder.createStore;
        })
      )
    );
    const mergedCount = yield* rdfBuilder.mergeStores(mainStore, externalStore);
    const logContext = P.isNotUndefined(contextId) ? {
      [contextLabel]: contextId,
      externalPath
    } : {externalPath};
    yield* Effect.logInfo("Merged external vocabularies into ontology", {
      ...logContext,
      newQuadsAdded: mergedCount,
    });
  }
});

/**
 * Parse ontology from RDF store using RdfService queries
 *
 * Uses RdfService's queryStore to extract classes and properties.
 * Works with domain types (IRI, Quad) instead of N3 types.
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const parseOntologyFromStore = (
  rdf: {
    readonly queryStore: (
      store: RdfStore,
      pattern: {
        readonly subject?: IRI | null;
        readonly predicate?: IRI | null;
        readonly object?: IRI | null;
        readonly graph?: IRI | null;
      }
    ) => Effect.Effect<Chunk.Chunk<Quad>, RdfError>;
  },
  store: RdfStore,
  ontologyPath: string
): Effect.Effect<
  {
    classes: Chunk.Chunk<ClassDefinition>;
    properties: Chunk.Chunk<PropertyDefinition>;
    hierarchy: Record<string, Array<IRI>>;
    propertyHierarchy: Record<string, Array<IRI>>;
  },
  OntologyParsingFailed
> =>
  Effect.gen(function* () {
    // Helper to fetch all values for a predicate into a Map
    const fetchPredicateMap = Effect.fn("fetchPredicateMap")(function* (predicate: IRI) {
      const quads = yield* rdf.queryStore(store, {predicate});
      const map = new Map<string, Array<string>>();
      for (const quad of Chunk.toReadonlyArray(quads)) {
        if (typeof quad.subject === "string" && !quad.subject.startsWith("_:")) {
          const subject = quad.subject;
          const value = S.is(Literal)(quad.object) ? quad.object.value : (quad.object as string);
          if (!map.has(subject)) {
            map.set(subject, []);
          }
          map.get(subject)!.push(value);
        }
      }
      return map;
    });

    // Helper to wrap predicate fetch with graceful failure handling
    // Returns empty map if the query fails, allowing partial ontology loads
    const fetchPredicateMapSafe = (predicate: IRI) =>
      fetchPredicateMap(predicate).pipe(
        Effect.catch((error) =>
          Effect.gen(function* () {
            yield* Effect.logWarning("Failed to fetch predicate metadata, using empty map", {
              predicate,
              error: String(error),
            });
            return new Map<string, Array<string>>();
          })
        )
      );

    // Helper to resolve RDF list (used for owl:unionOf)
    const resolveRdfList = (listNode: string): Effect.Effect<Array<string>, RdfError> =>
      Effect.gen(function* () {
        const items: Array<string> = [];
        let current = listNode;

        // Traverse the RDF list (max 100 iterations to prevent infinite loops)
        for (let i = 0; i < 100 && current && current !== RDF.nil; i++) {
          // Get rdf:first (the item at this position)
          const firstQuads = yield* rdf.queryStore(store, {
            subject: current as IRI,
            predicate: RDF.first,
          });
          for (const q of Chunk.toReadonlyArray(firstQuads)) {
            const value = S.is(Literal)(q.object) ? q.object.value : (q.object as string);
            // Only include named nodes (not blank nodes)
            if (typeof value === "string" && !value.startsWith("_:")) {
              items.push(value);
            }
          }

          // Get rdf:rest (pointer to next list node)
          const restQuads = yield* rdf.queryStore(store, {
            subject: current as IRI,
            predicate: RDF.rest,
          });
          const restQuad = Chunk.toReadonlyArray(restQuads)[0];
          current = P.isTruthy(restQuad)
            ? S.is(Literal)(restQuad.object)
              ? restQuad.object.value
              : (restQuad.object as string)
            : "";
        }

        return items;
      });

    // Helper to resolve blank node union classes (owl:unionOf)
    const resolveBlankNodeUnion = (blankNode: string): Effect.Effect<Array<string>, RdfError> =>
      Effect.gen(function* () {
        // Query for owl:unionOf on this blank node
        const unionQuads = yield* rdf.queryStore(store, {
          subject: blankNode as IRI,
          predicate: OWL.unionOf,
        });

        const members: Array<string> = [];
        for (const q of Chunk.toReadonlyArray(unionQuads)) {
          const listNode = S.is(Literal)(q.object) ? q.object.value : (q.object as string);
          const listItems = yield* resolveRdfList(listNode);
          members.push(...listItems);
        }

        return members;
      });

    // Fetch domain/range with blank node union resolution
    const fetchDomainRangeMap = Effect.fn("fetchDomainRangeMap")(function* (predicate: IRI) {
      const quads = yield* rdf.queryStore(store, {predicate});
      const map = new Map<string, Array<string>>();
      for (const quad of Chunk.toReadonlyArray(quads)) {
        if (typeof quad.subject === "string" && !quad.subject.startsWith("_:")) {
          const subject = quad.subject;
          const value = S.is(Literal)(quad.object) ? quad.object.value : (quad.object as string);
          if (!map.has(subject)) {
            map.set(subject, []);
          }
          if (typeof value === "string" && value.startsWith("_:")) {
            const unionMembers = yield* resolveBlankNodeUnion(value).pipe(
              Effect.orElseSucceed(() => [] as Array<string>)
            );
            map.get(subject)!.push(...unionMembers);
          } else {
            map.get(subject)!.push(value);
          }
        }
      }
      return map;
    });

    const fetchDomainRangeMapSafe = (predicate: IRI) =>
      fetchDomainRangeMap(predicate).pipe(
        Effect.catch((error) =>
          Effect.gen(function* () {
            yield* Effect.logWarning("Failed to fetch domain/range metadata, using empty map", {
              predicate,
              error: String(error),
            });
            return new Map<string, Array<string>>();
          })
        )
      );

    // Fetch all metadata in parallel batches with failure isolation
    const [
      labels,
      comments,
      domains,
      ranges,
      subClassOf,
      subPropertyOf,
      prefLabels,
      altLabels,
      hiddenLabels,
      definitions,
      scopeNotes,
      examples,
      broaders,
      narrowers,
      relateds,
      exactMatches,
      closeMatches,
      inverseOfs,
      equivalentClasses,
    ] = yield* Effect.all(
      [
        fetchPredicateMapSafe(RDFS_LABEL),
        fetchPredicateMapSafe(RDFS_COMMENT),
        fetchDomainRangeMapSafe(RDFS_DOMAIN), // Uses blank node union resolution
        fetchDomainRangeMapSafe(RDFS_RANGE), // Uses blank node union resolution
        fetchPredicateMapSafe(RDFS_SUBCLASSOF),
        fetchPredicateMapSafe(RDFS_SUBPROPERTYOF),
        fetchPredicateMapSafe(SKOS_PREFLABEL),
        fetchPredicateMapSafe(SKOS_ALTLABEL),
        fetchPredicateMapSafe(SKOS_HIDDENLABEL),
        fetchPredicateMapSafe(SKOS_DEFINITION),
        fetchPredicateMapSafe(SKOS_SCOPENOTE),
        fetchPredicateMapSafe(SKOS_EXAMPLE),
        fetchPredicateMapSafe(SKOS_BROADER),
        fetchPredicateMapSafe(SKOS_NARROWER),
        fetchPredicateMapSafe(SKOS_RELATED),
        fetchPredicateMapSafe(SKOS_EXACTMATCH),
        fetchPredicateMapSafe(SKOS_CLOSEMATCH),
        fetchPredicateMapSafe(OWL_INVERSEOF),
        fetchPredicateMapSafe(OWL_EQUIVALENT_CLASS),
      ],
      {concurrency: 5}
    );

    // Find all classes (subjects where ?s rdf:type owl:Class)
    const classQuads = yield* rdf.queryStore(store, {
      predicate: RDF_TYPE,
      object: OWL_CLASS,
    });

    // Build hierarchy map (child -> parents)
    const hierarchy: Record<string, Array<IRI>> = {};
    for (const [child, parents] of subClassOf.entries()) {
      hierarchy[child] = A.map(parents, (parent) => IRI.make(parent));
    }

    // Build property hierarchy map (child -> parents)
    const propertyHierarchy: Record<string, Array<IRI>> = {};
    for (const [child, parents] of subPropertyOf.entries()) {
      propertyHierarchy[child] = A.map(parents, (parent) => IRI.make(parent));
    }

    // Process Properties
    const objectPropQuads = yield* rdf.queryStore(store, {
      predicate: RDF_TYPE,
      object: OWL_OBJECT_PROPERTY,
    });
    const datatypePropQuads = yield* rdf.queryStore(store, {
      predicate: RDF_TYPE,
      object: OWL_DATATYPE_PROPERTY,
    });
    const functionalPropQuads = yield* rdf.queryStore(store, {
      predicate: RDF_TYPE,
      object: OWL_FUNCTIONAL_PROPERTY,
    });
    // Store as Set<string> for easy lookup by string IDs
    const functionalProps = new Set<string>(
      Chunk.toReadonlyArray(functionalPropQuads)
        .filter((q) => typeof q.subject === "string")
        .map((q) => q.subject as string)
    );

    const propInfos = new Map<string, {
      id: string;
      rangeType: "object" | "datatype"
    }>();
    for (const quad of Chunk.toReadonlyArray(objectPropQuads)) {
      if (typeof quad.subject === "string" && !quad.subject.startsWith("_:")) {
        propInfos.set(quad.subject, {id: quad.subject, rangeType: "object"});
      }
    }
    for (const quad of Chunk.toReadonlyArray(datatypePropQuads)) {
      if (typeof quad.subject === "string" && !quad.subject.startsWith("_:")) {
        propInfos.set(quad.subject, {id: quad.subject, rangeType: "datatype"});
      }
    }

    // Link props to classes
    const classProperties = new Map<string, Array<string>>(); // classIRI -> propIRIs
    for (const [propIri, _] of propInfos) {
      const propDomains = domains.get(propIri) || [];
      for (const domainIri of propDomains) {
        if (!classProperties.has(domainIri)) {
          classProperties.set(domainIri, []);
        }
        classProperties.get(domainIri)!.push(propIri);
      }
    }

    // RDF store values cross the schema boundary here before entering domain models.
    const asIriArray = (iris: ReadonlyArray<string>): ReadonlyArray<IRI> => A.map(iris, (iri) => IRI.make(iri));

    // Helper to get array with fallback
    const getOrEmpty = (map: Map<string, Array<string>>, id: string): Array<string> => map.get(id) || [];

    // Finalize Classes
    const finalClasses: Array<ClassDefinition> = [];
    const classSet = new Set<string>(); // To ensure unique classes
    for (const quad of Chunk.toReadonlyArray(classQuads)) {
      if (typeof quad.subject === "string" && !quad.subject.startsWith("_:")) {
        const id = quad.subject;
        if (classSet.has(id)) continue;
        classSet.add(id);

        if (P.isNotUndefined(labels.get(id)?.[0]) || P.isNotUndefined(prefLabels.get(id)?.[0])) {
          finalClasses.push(
            ClassDefinition.fromUnknown({
              id: IRI.make(id),
              label: labels.get(id)?.[0] || prefLabels.get(id)?.[0] || "",
              comment: O.some(comments.get(id)?.[0] || ""),
              // properties field expects IRI[], coerce from string[]
              properties: asIriArray(getOrEmpty(classProperties, id)),
              prefLabels: getOrEmpty(prefLabels, id),
              altLabels: getOrEmpty(altLabels, id),
              hiddenLabels: getOrEmpty(hiddenLabels, id),
              definition: O.fromNullishOr(definitions.get(id)?.[0]),
              scopeNote: O.fromNullishOr(scopeNotes.get(id)?.[0]),
              example: O.fromNullishOr(examples.get(id)?.[0]),
              // SKOS fields expect string[] (full IRIs as strings)
              broader: asIriArray(getOrEmpty(broaders, id)),
              narrower: asIriArray(getOrEmpty(narrowers, id)),
              related: asIriArray(getOrEmpty(relateds, id)),
              exactMatch: asIriArray(getOrEmpty(exactMatches, id)),
              closeMatch: asIriArray(getOrEmpty(closeMatches, id)),
              equivalentClass: asIriArray(getOrEmpty(equivalentClasses, id)),
            })
          );
        }
      }
    }

    // Finalize Properties
    const finalProperties: Array<PropertyDefinition> = [];
    for (const [id, info] of propInfos) {
      if (P.isNotUndefined(labels.get(id)?.[0]) || P.isNotUndefined(prefLabels.get(id)?.[0])) {
        finalProperties.push(
          PropertyDefinition.fromUnknown({
            id: IRI.make(id),
            label: labels.get(id)?.[0] || prefLabels.get(id)?.[0] || "",
            comment: O.some(comments.get(id)?.[0] || ""),
            // domain/range expect string[] (full IRIs as strings)
            domain: asIriArray(getOrEmpty(domains, id)),
            range: asIriArray(getOrEmpty(ranges, id)),
            rangeType: info.rangeType,
            isFunctional: functionalProps.has(id),
            prefLabels: getOrEmpty(prefLabels, id),
            altLabels: getOrEmpty(altLabels, id),
            hiddenLabels: getOrEmpty(hiddenLabels, id),
            definition: O.fromNullishOr(definitions.get(id)?.[0]),
            scopeNote: O.fromNullishOr(scopeNotes.get(id)?.[0]),
            example: O.fromNullishOr(examples.get(id)?.[0]),
            // SKOS fields expect string[] (full IRIs as strings)
            broader: asIriArray(getOrEmpty(broaders, id)),
            narrower: asIriArray(getOrEmpty(narrowers, id)),
            related: asIriArray(getOrEmpty(relateds, id)),
            exactMatch: asIriArray(getOrEmpty(exactMatches, id)),
            closeMatch: asIriArray(getOrEmpty(closeMatches, id)),
            inverseOf: asIriArray(getOrEmpty(inverseOfs, id)),
          })
        );
      }
    }

    return {
      classes: Chunk.fromIterable(finalClasses),
      properties: Chunk.fromIterable(finalProperties),
      hierarchy,
      propertyHierarchy,
    };
  }).pipe(
    Effect.mapError((error) =>
      OntologyParsingFailed.fromUnknown({
        message: `Failed to parse ontology at ${ontologyPath}`,
        path: ontologyPath,
        cause: error,
      })
    )
  );

/**
 * OntologyService - Ontology loading using RdfService abstraction
 *
 * Loads ontology from file, parses using RdfService, and extracts classes/properties
 * using RdfService queries. Backend-agnostic: works with any RDF engine.
 *
 * @since 2.0.0
 * @category Services
 */
export class OntologyService extends Context.Service<OntologyService>()($I`OntologyService`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;
    const storage = yield* StorageService;
    const rdf = yield* RdfBuilder;
    const nlp = yield* NlpService;
    // Registry is optional - only available when ONTOLOGY.REGISTRY_PATH is configured
    const registryOpt = yield* Effect.serviceOption(OntologyRegistryService);

    // Cache ontology with configurable TTL to allow refresh without restart
    const cacheTtl = Duration.seconds(config.ontology.cacheTtlSeconds);
    const getOntology = yield* Effect.cachedWithTTL(cacheTtl)(
      Effect.gen(function* () {
        const ontologyPath = config.ontology.path;

        // Load main ontology
        const contentOpt = yield* storage.get(ontologyPath).pipe(
          Effect.mapError((error) =>
            OntologyFileNotFound.fromUnknown({
              message: `Failed to read ontology from storage at ${ontologyPath}`,
              path: ontologyPath,
              cause: error,
            })
          )
        );

        if (contentOpt === undefined) {
          return yield* OntologyFileNotFound.fromUnknown({
            message: `Ontology file not found at ${ontologyPath}`,
            path: ontologyPath,
          });
        }

        const turtleContent = contentOpt;
        const mainStore = yield* rdf.parseTurtle(turtleContent);

        // Load and merge external vocabularies (PROV-O, W3C ORG, etc.)
        const externalPath = config.ontology.externalVocabsPath;
        yield* loadAndMergeExternalVocabularies(mainStore, externalPath, "main", undefined, storage, rdf);

        return yield* parseOntologyFromStore(rdf, mainStore, ontologyPath);
      })
    );

    // Cache BM25 index with same TTL as ontology to stay in sync
    const getBm25Index = yield* Effect.cachedWithTTL(cacheTtl)(
      Effect.gen(function* () {
        const {
          classes,
          hierarchy,
          properties,
          propertyHierarchy
        } = yield* getOntology;
        const ontology = OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties),
        });
        return yield* nlp.createOntologyIndex(ontology);
      })
    );

    // Cache Semantic index with same TTL as ontology to stay in sync
    const getSemanticIndex = yield* Effect.cachedWithTTL(cacheTtl)(
      Effect.gen(function* () {
        const {
          classes,
          hierarchy,
          properties,
          propertyHierarchy
        } = yield* getOntology;
        const ontology = OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties),
        });
        return yield* nlp.createOntologySemanticIndex(ontology);
      })
    );

    // Per-URI ontology cache for multi-ontology support
    // Each ontology is cached with timestamp for TTL-based expiration
    type CachedOntology = {
      readonly data: {
        readonly classes: Chunk.Chunk<ClassDefinition>;
        readonly properties: Chunk.Chunk<PropertyDefinition>;
        readonly hierarchy: Record<string, Array<IRI>>;
        readonly propertyHierarchy: Record<string, Array<IRI>>;
      };
      readonly loadedAt: number;
    };
    const ontologyCacheRef = yield* Ref.make(HashMap.empty<string, CachedOntology>());
    const cacheTtlMs = Duration.toMillis(cacheTtl);

    /**
     * Load ontology from a specific URI with per-URI caching.
     * This enables multi-ontology deployments where each request
     * can specify its own ontology (e.g., Seattle, Wikipedia, etc.)
     */
    const loadOntologyFromUri = Effect.fn("loadOntologyFromUri")(function* (uri: string) {
      const storagePath = uri.startsWith("gs://") ? uri.replace(/^gs:\/\/[^/]+\//, "") : uri;
      const cache = yield* Ref.get(ontologyCacheRef);
      const cached = HashMap.get(cache, uri);
      const now = yield* Clock.currentTimeMillis;
      if (Option.isSome(cached) && now - cached.value.loadedAt < cacheTtlMs) {
        yield* Effect.logDebug("Using cached ontology", {
          uri,
          age: now - cached.value.loadedAt
        });
        return cached.value.data;
      }
      yield* Effect.logInfo("Loading ontology from URI", {uri, storagePath});
      const contentOpt = yield* storage.get(storagePath).pipe(
        Effect.mapError((error) =>
          OntologyFileNotFound.fromUnknown({
            message: `Failed to read ontology from storage at ${uri}`,
            path: uri,
            cause: error,
          })
        )
      );
      if (contentOpt === undefined) {
        return yield* OntologyFileNotFound.fromUnknown({
          message: `Ontology file not found at ${uri}`,
          path: uri,
        });
      }
      const turtleContent = contentOpt;
      const mainStore = yield* rdf.parseTurtle(turtleContent);
      const externalPath = config.ontology.externalVocabsPath;
      yield* loadAndMergeExternalVocabularies(mainStore, externalPath, "uri", uri, storage, rdf);
      const parsed = yield* parseOntologyFromStore(rdf, mainStore, uri);
      yield* Ref.update(ontologyCacheRef, (cache) => HashMap.set(cache, uri, {
        data: parsed,
        loadedAt: now
      }));
      yield* Effect.logInfo("Ontology loaded and cached", {
        uri,
        classCount: Chunk.size(parsed.classes),
        propertyCount: Chunk.size(parsed.properties),
      });
      return parsed;
    });

    /**
     * Load ontology from a registry entry with proper external vocab handling
     */
    const loadOntologyFromEntry = Effect.fn("loadOntologyFromEntry")(function* (entry: OntologyEntry) {
      const cacheKey = entry.iri;
      const cache = yield* Ref.get(ontologyCacheRef);
      const cached = HashMap.get(cache, cacheKey);
      const now = yield* Clock.currentTimeMillis;
      if (Option.isSome(cached) && now - cached.value.loadedAt < cacheTtlMs) {
        yield* Effect.logDebug("Using cached ontology from registry", {
          id: entry.id,
          iri: entry.iri,
          age: now - cached.value.loadedAt,
        });
        return cached.value.data;
      }
      yield* Effect.logInfo("Loading ontology from registry entry", {
        id: entry.id,
        iri: entry.iri,
        storagePath: entry.storagePath,
      });
      const contentOpt = yield* storage.get(entry.storagePath).pipe(
        Effect.mapError((error) =>
          OntologyFileNotFound.fromUnknown({
            message: `Failed to read ontology from storage at ${entry.storagePath}`,
            path: entry.storagePath,
            cause: error,
          })
        )
      );
      if (contentOpt === undefined) {
        return yield* OntologyFileNotFound.fromUnknown({
          message: `Ontology file not found at ${entry.storagePath}`,
          path: entry.storagePath,
        });
      }
      const turtleContent = contentOpt;
      const mainStore = yield* rdf.parseTurtle(turtleContent);
      if (O.isSome(entry.externalVocabsPath)) {
        yield* loadAndMergeExternalVocabularies(
          mainStore,
          entry.externalVocabsPath.value,
          "entryId",
          entry.id,
          storage,
          rdf
        );
      }
      const parsed = yield* parseOntologyFromStore(rdf, mainStore, entry.storagePath);
      yield* Ref.update(ontologyCacheRef, (cache) => HashMap.set(cache, cacheKey, {
        data: parsed,
        loadedAt: now
      }));
      yield* Effect.logInfo("Ontology loaded from registry and cached", {
        id: entry.id,
        iri: entry.iri,
        classCount: Chunk.size(parsed.classes),
        propertyCount: Chunk.size(parsed.properties),
      });
      return parsed;
    });

    return {
      loadFromUri: Effect.fn("OntologyService.loadFromUri")((uri: string) =>
        loadOntologyFromUri(uri).pipe(
          Effect.map(({classes, hierarchy, properties, propertyHierarchy}) =>
            OntologyContext.make({
              classes: Chunk.toReadonlyArray(classes),
              hierarchy,
              propertyHierarchy,
              properties: Chunk.toReadonlyArray(properties),
            })
          )
        )
      ),
      loadFromRegistryEntry: Effect.fn("OntologyService.loadFromRegistryEntry")((entry: OntologyEntry) =>
        loadOntologyFromEntry(entry).pipe(
          Effect.map(({classes, hierarchy, properties, propertyHierarchy}) =>
            OntologyContext.make({
              classes: Chunk.toReadonlyArray(classes),
              hierarchy,
              propertyHierarchy,
              properties: Chunk.toReadonlyArray(properties),
            })
          )
        )
      ),
      resolveAndLoad: Effect.fn("OntologyService.resolveAndLoad")(function* (identifier: string) {
        if (Option.isSome(registryOpt)) {
          const registry = registryOpt.value;
          const entryOpt = yield* registry.resolveToEntry(identifier).pipe(
            Effect.catch((error) =>
              Effect.gen(function* () {
                yield* Effect.logDebug("Registry resolution failed, falling back to direct load", {
                  identifier,
                  error: String(error),
                });
                return Option.none<OntologyEntry>();
              })
            )
          );
          if (Option.isSome(entryOpt)) {
            const {
              classes,
              hierarchy,
              properties,
              propertyHierarchy
            } = yield* loadOntologyFromEntry(entryOpt.value);
            return OntologyContext.make({
              classes: Chunk.toReadonlyArray(classes),
              hierarchy,
              propertyHierarchy,
              properties: Chunk.toReadonlyArray(properties),
            });
          }
        }
        const {
          classes,
          hierarchy,
          properties,
          propertyHierarchy
        } = yield* loadOntologyFromUri(identifier);
        return OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties),
        });
      }),
      getRegistryEntry: Effect.fn("OntologyService.getRegistryEntry")(function* (identifier: string) {
        if (Option.isNone(registryOpt)) {
          return Option.none<OntologyEntry>();
        }
        const registry = registryOpt.value;
        return yield* registry
          .resolveToEntry(identifier)
          .pipe(Effect.orElseSucceed(() => Option.none<OntologyEntry>()));
      }),
      hasRegistry: Effect.succeed(Option.isSome(registryOpt)),
      generateVersion: (ontologyId: string, ontologyIri: string): OntologyVersion => {
        const hash = createHash("sha256").update(ontologyIri).digest("hex").slice(0, 16);
        return `${ontologyId}/${ontologyId}@${hash}` as OntologyVersion;
      },
      searchClassesHybridFromUri: Effect.fn("OntologyService.searchClassesHybridFromUri")(function* (
        uri: string,
        query: string,
        limit: number = 100
      ) {
        const {
          classes,
          hierarchy,
          properties,
          propertyHierarchy
        } = yield* loadOntologyFromUri(uri);
        const ontology = OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties),
        });
        const [bm25Index, semanticIndex] = yield* Effect.all(
          [
            nlp.createOntologyIndex(ontology),
            nlp.createOntologySemanticIndex(ontology),
          ],
          {concurrency: 2}
        );
        const searchLimit = Math.ceil(limit * 0.7);
        const [semanticResults, bm25Results] = yield* Effect.all(
          [
            P.isNotNull(semanticIndex)
              ? Effect.gen(function* () {
                const results = yield* nlp.searchOntologySemanticIndex(semanticIndex, query, searchLimit);
                const classesMap = new Map<string, ClassDefinition>();
                for (const result of results) {
                  if (P.isNotUndefined(result.class)) {
                    classesMap.set(result.class.id, result.class);
                  }
                  if (P.isNotUndefined(result.property)) {
                    for (const domainIri of result.property.domain) {
                      const domainClass = ontology.classes.find((c) => c.id === domainIri);
                      if (P.isNotUndefined(domainClass)) {
                        classesMap.set(domainClass.id, domainClass);
                      }
                    }
                  }
                }
                return Chunk.fromIterable(classesMap.values());
              }).pipe(Effect.orElseSucceed(() => Chunk.empty<ClassDefinition>()))
              : Effect.succeed(Chunk.empty<ClassDefinition>()),
            Effect.gen(function* () {
              const results = yield* nlp.searchOntologyIndex(bm25Index, query, searchLimit);
              const classesMap = new Map<string, ClassDefinition>();
              for (const result of results) {
                if (P.isNotUndefined(result.class)) {
                  classesMap.set(result.class.id, result.class);
                }
                if (P.isNotUndefined(result.property)) {
                  for (const domainIri of result.property.domain) {
                    const domainClass = ontology.classes.find((c) => c.id === domainIri);
                    if (P.isNotUndefined(domainClass)) {
                      classesMap.set(domainClass.id, domainClass);
                    }
                  }
                }
              }
              return Chunk.fromIterable(classesMap.values());
            }),
          ],
          {concurrency: 2}
        );
        const semanticArray = Chunk.toReadonlyArray(semanticResults);
        const bm25Array = Chunk.toReadonlyArray(bm25Results);
        const fused = rrfFusion([semanticArray, bm25Array]);
        const fusedIds = new Set(fused.map((r) => r.id));
        const remaining: Array<ClassDefinition> = [];
        if (fused.length < limit && ontology.classes.length <= limit) {
          for (const cls of ontology.classes) {
            if (!fusedIds.has(cls.id)) remaining.push(cls);
          }
        }
        yield* Effect.logDebug("URI-specific hybrid search complete", {
          uri,
          query,
          semanticCount: semanticArray.length,
          bm25Count: bm25Array.length,
          fusedCount: fused.length,
          ontologySize: ontology.classes.length,
        });
        const results = [
          ...fused.map((r) => {
            const {rrfScore: _, ...cls} = r;
            return cls as ClassDefinition;
          }),
          ...remaining,
        ];
        return Chunk.fromIterable(results.slice(0, limit));
      }),
      getPropertiesForFromUri: Effect.fn("OntologyService.getPropertiesForFromUri")(function* (
        uri: string,
        classIris: ReadonlyArray<string>
      ) {
        const {
          classes,
          hierarchy,
          properties,
          propertyHierarchy
        } = yield* loadOntologyFromUri(uri);
        const ontology = OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties),
        });
        const props: Array<PropertyDefinition> = [];
        for (const classIri of classIris) {
          const classProps = ontology.getPropertiesForClass(classIri);
          for (const prop of classProps) {
            props.push(prop);
          }
        }
        const uniqueProps = new Map<string, PropertyDefinition>();
        for (const prop of props) {
          uniqueProps.set(prop.id, prop);
        }
        return Chunk.fromIterable(uniqueProps.values());
      }),
      searchClassesHybridFromUriWithEmbeddings: Effect.fn("OntologyService.searchClassesHybridFromUriWithEmbeddings")(
        function* (uri: string, query: string, embeddings: OntologyEmbeddings, limit: number = 100) {
          const {
            classes,
            hierarchy,
            properties,
            propertyHierarchy
          } = yield* loadOntologyFromUri(uri);
          const ontology = OntologyContext.make({
            classes: Chunk.toReadonlyArray(classes),
            hierarchy,
            propertyHierarchy,
            properties: Chunk.toReadonlyArray(properties),
          });
          const searchLimit = Math.ceil(limit * 0.7);
          const semanticIndex = yield* nlp.createOntologySemanticIndexFromPrecomputed(ontology, embeddings);
          const bm25Index = yield* nlp.createOntologyIndex(ontology);
          const [semanticResults, bm25Results] = yield* Effect.all(
            [
              P.isNotNull(semanticIndex)
                ? Effect.gen(function* () {
                  const results = yield* nlp.searchOntologySemanticIndex(semanticIndex, query, searchLimit);
                  const classesMap = new Map<string, ClassDefinition>();
                  for (const result of results) {
                    if (P.isNotUndefined(result.class)) {
                      classesMap.set(result.class.id, result.class);
                    }
                    if (P.isNotUndefined(result.property)) {
                      for (const domainIri of result.property.domain) {
                        const domainClass = ontology.classes.find((c) => c.id === domainIri);
                        if (P.isNotUndefined(domainClass)) {
                          classesMap.set(domainClass.id, domainClass);
                        }
                      }
                    }
                  }
                  return Chunk.fromIterable(classesMap.values());
                }).pipe(Effect.orElseSucceed(() => Chunk.empty<ClassDefinition>()))
                : Effect.succeed(Chunk.empty<ClassDefinition>()),
              Effect.gen(function* () {
                const results = yield* nlp.searchOntologyIndex(bm25Index, query, searchLimit);
                const classesMap = new Map<string, ClassDefinition>();
                for (const result of results) {
                  if (P.isNotUndefined(result.class)) {
                    classesMap.set(result.class.id, result.class);
                  }
                  if (P.isNotUndefined(result.property)) {
                    for (const domainIri of result.property.domain) {
                      const domainClass = ontology.classes.find((c) => c.id === domainIri);
                      if (P.isNotUndefined(domainClass)) {
                        classesMap.set(domainClass.id, domainClass);
                      }
                    }
                  }
                }
                return Chunk.fromIterable(classesMap.values());
              }),
            ],
            {concurrency: 2}
          );
          const semanticArray = Chunk.toReadonlyArray(semanticResults);
          const bm25Array = Chunk.toReadonlyArray(bm25Results);
          const fused = rrfFusion([semanticArray, bm25Array]);
          const fusedIds = new Set(fused.map((r) => r.id));
          const remaining: Array<ClassDefinition> = [];
          if (fused.length < limit && ontology.classes.length <= limit) {
            for (const cls of ontology.classes) {
              if (!fusedIds.has(cls.id)) remaining.push(cls);
            }
          }
          yield* Effect.logDebug("URI-specific hybrid search with embeddings complete", {
            uri,
            query,
            semanticCount: semanticArray.length,
            bm25Count: bm25Array.length,
            fusedCount: fused.length,
            ontologySize: ontology.classes.length,
          });
          const results = [
            ...fused.map((r) => {
              const {rrfScore: _, ...cls} = r;
              return cls as ClassDefinition;
            }),
            ...remaining,
          ];
          return Chunk.fromIterable(results.slice(0, limit));
        }
      ),
      ontology: Effect.gen(function* () {
        const {
          classes,
          hierarchy,
          properties,
          propertyHierarchy
        } = yield* getOntology;
        return OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties),
        });
      }),
      searchClasses: Effect.fn("OntologyService.searchClasses")(function* (query: string, limit: number = 10) {
        const {
          classes,
          hierarchy,
          properties,
          propertyHierarchy
        } = yield* getOntology;
        const ontology = OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties),
        });
        const index = yield* getBm25Index;
        const results = yield* nlp.searchOntologyIndex(index, query, limit);
        const validClasses = new Map<string, ClassDefinition>();
        for (const result of results) {
          if (P.isNotUndefined(result.class)) {
            validClasses.set(result.class.id, result.class);
          }
          if (P.isNotUndefined(result.property)) {
            for (const domainIri of result.property.domain) {
              const domainClass = ontology.classes.find((c) => c.id === domainIri);
              if (P.isNotUndefined(domainClass)) {
                validClasses.set(domainClass.id, domainClass);
              }
            }
          }
        }
        return Chunk.fromIterable(validClasses.values());
      }),
      searchProperties: Effect.fn("OntologyService.searchProperties")(function* (query: string, limit: number = 10) {
        const index = yield* getBm25Index;
        const results = yield* nlp.searchOntologyIndex(index, query, limit);
        return Chunk.fromIterable(results.filter((r) => r.property !== undefined).map((r) => r.property!));
      }),
      getPropertiesFor: Effect.fn("OntologyService.getPropertiesFor")(function* (classIris: ReadonlyArray<string>) {
        const {
          classes,
          hierarchy,
          properties,
          propertyHierarchy
        } = yield* getOntology;
        const ontology = OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties),
        });
        const props: Array<PropertyDefinition> = [];
        for (const classIri of classIris) {
          const classProps = ontology.getPropertiesForClass(classIri);
          for (const prop of classProps) {
            props.push(prop);
          }
        }
        const uniqueProps = new Map<string, PropertyDefinition>();
        for (const prop of props) {
          uniqueProps.set(prop.id, prop);
        }
        return Chunk.fromIterable(uniqueProps.values());
      }),
      searchClassesSemantic: Effect.fn("OntologyService.searchClassesSemantic")(function* (
        query: string,
        limit: number = 10
      ) {
        const {
          classes,
          hierarchy,
          properties,
          propertyHierarchy
        } = yield* getOntology;
        const ontology = OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties),
        });
        const index = yield* getSemanticIndex;
        const results = yield* nlp.searchOntologySemanticIndex(index, query, limit);
        const validClasses = new Map<string, ClassDefinition>();
        for (const result of results) {
          if (P.isNotUndefined(result.class)) {
            validClasses.set(result.class.id, result.class);
          }
          if (P.isNotUndefined(result.property)) {
            for (const domainIri of result.property.domain) {
              const domainClass = ontology.classes.find((c) => c.id === domainIri);
              if (P.isNotUndefined(domainClass)) {
                validClasses.set(domainClass.id, domainClass);
              }
            }
          }
        }
        return Chunk.fromIterable(validClasses.values());
      }),
      searchPropertiesSemantic: Effect.fn("OntologyService.searchPropertiesSemantic")(function* (
        query: string,
        limit: number = 10
      ) {
        const index = yield* getSemanticIndex;
        const results = yield* nlp.searchOntologySemanticIndex(index, query, limit);
        return Chunk.fromIterable(results.filter((r) => r.property !== undefined).map((r) => r.property!));
      }),
      searchClassesHybrid: Effect.fn("OntologyService.searchClassesHybrid")(function* (
        query: string,
        limit: number = 100
      ) {
        const {
          classes,
          hierarchy,
          properties,
          propertyHierarchy
        } = yield* getOntology;
        const ontology = OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties),
        });
        const searchLimit = Math.ceil(limit * 0.7);
        const [semanticResults, bm25Results] = yield* Effect.all(
          [
            Effect.gen(function* () {
              const semanticIndex = yield* getSemanticIndex;
              const results = yield* nlp.searchOntologySemanticIndex(semanticIndex, query, searchLimit);
              const classesMap = new Map<string, ClassDefinition>();
              for (const result of results) {
                if (P.isNotUndefined(result.class)) {
                  classesMap.set(result.class.id, result.class);
                }
                if (P.isNotUndefined(result.property)) {
                  for (const domainIri of result.property.domain) {
                    const domainClass = ontology.classes.find((c) => c.id === domainIri);
                    if (P.isNotUndefined(domainClass)) {
                      classesMap.set(domainClass.id, domainClass);
                    }
                  }
                }
              }
              return Chunk.fromIterable(classesMap.values());
            }).pipe(
              Effect.catch(
                Effect.fn(function* (error) {
                  yield* Effect.logWarning("Semantic search failed, using BM25 fallback", {
                    error: String(error),
                    query,
                  });
                  return Chunk.empty<ClassDefinition>();
                })
              )
            ),
            Effect.gen(function* () {
              const bm25Index = yield* getBm25Index;
              const results = yield* nlp.searchOntologyIndex(bm25Index, query, searchLimit);
              const classesMap = new Map<string, ClassDefinition>();
              for (const result of results) {
                if (P.isNotUndefined(result.class)) {
                  classesMap.set(result.class.id, result.class);
                }
                if (P.isNotUndefined(result.property)) {
                  for (const domainIri of result.property.domain) {
                    const domainClass = ontology.classes.find((c) => c.id === domainIri);
                    if (P.isNotUndefined(domainClass)) {
                      classesMap.set(domainClass.id, domainClass);
                    }
                  }
                }
              }
              return Chunk.fromIterable(classesMap.values());
            }),
          ],
          {concurrency: 2}
        );
        const semanticArray = Chunk.toReadonlyArray(semanticResults);
        const bm25Array = Chunk.toReadonlyArray(bm25Results);
        const fused = rrfFusion([semanticArray, bm25Array]);
        const fusedIds = new Set(fused.map((r) => r.id));
        const remaining: Array<ClassDefinition> = [];
        if (fused.length < limit && ontology.classes.length <= limit) {
          for (const cls of ontology.classes) {
            if (!fusedIds.has(cls.id)) remaining.push(cls);
          }
        }
        yield* Effect.logDebug("Hybrid search complete", {
          query,
          semanticCount: semanticArray.length,
          bm25Count: bm25Array.length,
          fusedCount: fused.length,
          ontologySize: ontology.classes.length,
          limit,
        });
        const results = [
          ...A.map(fused, (r) => {
            const {rrfScore: _, ...cls} = r;
            return cls as ClassDefinition;
          }),
          ...remaining,
        ];
        return Chunk.fromIterable(results.slice(0, limit));
      }),
      searchClassesHybridWithEmbeddings: Effect.fn("OntologyService.searchClassesHybridWithEmbeddings")(function* (
        query: string,
        embeddings: OntologyEmbeddings,
        limit: number = 100
      ) {
        const {
          classes,
          hierarchy,
          properties,
          propertyHierarchy
        } = yield* getOntology;
        const ontology = OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties),
        });
        const searchLimit = Math.ceil(limit * 0.7);
        const semanticIndex = yield* nlp.createOntologySemanticIndexFromPrecomputed(ontology, embeddings);
        const [semanticResults, bm25Results] = yield* Effect.all(
          [
            Effect.gen(function* () {
              const results = yield* nlp.searchOntologySemanticIndex(semanticIndex, query, searchLimit);
              const classesMap = new Map<string, ClassDefinition>();
              for (const result of results) {
                if (P.isNotUndefined(result.class)) {
                  classesMap.set(result.class.id, result.class);
                }
                if (P.isNotUndefined(result.property)) {
                  for (const domainIri of result.property.domain) {
                    const domainClass = ontology.classes.find((c) => c.id === domainIri);
                    if (P.isNotUndefined(domainClass)) {
                      classesMap.set(domainClass.id, domainClass);
                    }
                  }
                }
              }
              return Chunk.fromIterable(classesMap.values());
            }).pipe(
              Effect.catch(
                Effect.fn(function* (error)  {
                  yield* Effect.logWarning("Semantic search with embeddings failed, using BM25 fallback", {
                    error: String(error),
                    query,
                  });
                  return Chunk.empty<ClassDefinition>();
                })
              )
            ),
            Effect.gen(function* () {
              const bm25Index = yield* getBm25Index;
              const results = yield* nlp.searchOntologyIndex(bm25Index, query, searchLimit);
              const classesMap = new Map<string, ClassDefinition>();
              for (const result of results) {
                if (P.isNotUndefined(result.class)) {
                  classesMap.set(result.class.id, result.class);
                }
                if (P.isNotUndefined(result.property)) {
                  for (const domainIri of result.property.domain) {
                    const domainClass = ontology.classes.find((c) => c.id === domainIri);
                    if (P.isNotUndefined(domainClass)) {
                      classesMap.set(domainClass.id, domainClass);
                    }
                  }
                }
              }
              return Chunk.fromIterable(classesMap.values());
            }),
          ],
          {concurrency: 2}
        );
        const semanticArray = Chunk.toReadonlyArray(semanticResults);
        const bm25Array = Chunk.toReadonlyArray(bm25Results);
        const fused = rrfFusion([semanticArray, bm25Array]);
        const fusedIds = new Set(fused.map((r) => r.id));
        const remaining: Array<ClassDefinition> = [];
        if (fused.length < limit && ontology.classes.length <= limit) {
          for (const cls of ontology.classes) {
            if (!fusedIds.has(cls.id)) remaining.push(cls);
          }
        }
        yield* Effect.logDebug("Hybrid search with pre-computed embeddings complete", {
          query,
          semanticCount: semanticArray.length,
          bm25Count: bm25Array.length,
          fusedCount: fused.length,
          ontologySize: ontology.classes.length,
          limit,
        });
        const results = [
          ...fused.map((r) => {
            const {rrfScore: _, ...cls} = r;
            return cls as ClassDefinition;
          }),
          ...remaining,
        ];
        return Chunk.fromIterable(results.slice(0, limit));
      }),
      getClassHierarchyChecker: Effect.fn("OntologyService.getClassHierarchyChecker")(function* () {
        const {
          classes,
          hierarchy,
          properties,
          propertyHierarchy
        } = yield* getOntology;
        const ontology = OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties),
        });
        return (childIri: string, parentIri: string): boolean =>
          ontology.isSubClassOf(IRI.make(childIri), IRI.make(parentIri));
      }),
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(
    Layer.provide([
      RdfBuilder.Default, // Includes ConfigServiceDefault
      NlpService.Default,
      // StorageService provided by parent scope (runtime-selected storage type)
    ])
  );
}
