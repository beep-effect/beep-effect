/**
 * Service: Ontology Services
 *
 * **Details**
 *
 * Production-ready ontology loading using RdfService abstraction.
 * Parses OWL/RDFS ontologies and exposes classes and properties.
 * Backend-agnostic: works with any RDF engine via RdfService.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
import { $ScratchpadId } from "@beep/identity";
import type { GraphTerm, NamedNode, ObjectTerm, Quad, Subject } from "@beep/rdf";
import { IRI, makeBlankNode, makeNamedNode } from "@beep/rdf";
import { OWL_CLASS, OWL_DATATYPE_PROPERTY, OWL_NAMESPACE, OWL_OBJECT_PROPERTY } from "@beep/rdf/Vocab/Owl";
import { RDF_FIRST, RDF_NIL, RDF_REST, RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_COMMENT, RDFS_LABEL, RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs";
import {
  SKOS_ALT_LABEL as SKOS_ALTLABEL,
  SKOS_BROADER,
  SKOS_CLOSE_MATCH as SKOS_CLOSEMATCH,
  SKOS_DEFINITION,
  SKOS_EXACT_MATCH as SKOS_EXACTMATCH,
  SKOS_HIDDEN_LABEL as SKOS_HIDDENLABEL,
  SKOS_NAMESPACE,
  SKOS_NARROWER,
  SKOS_PREF_LABEL as SKOS_PREFLABEL,
  SKOS_RELATED,
  SKOS_SCOPE_NOTE as SKOS_SCOPENOTE,
} from "@beep/rdf/Vocab/Skos";
import { FilePath } from "@beep/schema";
import { PosInt } from "@beep/schema/Int";
import {
  Chunk,
  Clock,
  Context,
  Duration,
  Effect,
  HashMap,
  HashSet,
  Layer,
  MutableHashMap,
  MutableHashSet,
  Ref,
} from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { OntologyError, OntologyFileNotFound, OntologyParsingFailed } from "../Domain/Error/Ontology.ts";
import type { RdfError } from "../Domain/Error/Rdf.ts";
import { ContentHash, Namespace, OntologyName, OntologyVersion } from "../Domain/Identity.ts";
import { ClassDefinition, OntologyContext, PropertyDefinition } from "../Domain/Model/Ontology.ts";
import type { OntologyEmbeddings } from "../Domain/Model/OntologyEmbeddings.ts";
import type { OntologyEntry } from "../Domain/Schema/OntologyRegistry.ts";
import { dual3 } from "../Utils/Dual.ts";
import { rrfFusion } from "../Utils/Retrieval.ts";
import { ConfigService } from "./Config.ts";
import { NlpService } from "./Nlp.ts";
import { OntologyRegistryService } from "./OntologyRegistry.ts";
import type { RdfBuilderShape, RdfStore } from "./Rdf.ts";
import { RdfBuilder } from "./Rdf.ts";

const namedNodeValue = (value: IRI | NamedNode): string => (P.isString(value) ? value : value.value);

import type { StorageServiceMethods } from "./Storage.ts";
import { StorageService } from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Ontology");
const RDFS_DOMAIN = makeNamedNode(`${RDFS_NAMESPACE}domain`);
const RDFS_RANGE = makeNamedNode(`${RDFS_NAMESPACE}range`);
const RDFS_SUBCLASSOF = makeNamedNode(`${RDFS_NAMESPACE}subClassOf`);
const RDFS_SUBPROPERTYOF = makeNamedNode(`${RDFS_NAMESPACE}subPropertyOf`);
const SKOS_EXAMPLE = makeNamedNode(`${SKOS_NAMESPACE}example`);
const OWL_FUNCTIONAL_PROPERTY = makeNamedNode(`${OWL_NAMESPACE}FunctionalProperty`);
const OWL_INVERSEOF = makeNamedNode(`${OWL_NAMESPACE}inverseOf`);
const OWL_EQUIVALENT_CLASS = makeNamedNode(`${OWL_NAMESPACE}equivalentClass`);
const OWL_UNION_OF = makeNamedNode(`${OWL_NAMESPACE}unionOf`);

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
          ? { [contextLabel]: contextId, path: externalPath }
          : { path: externalPath };
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
            ? { [contextLabel]: contextId, path: externalPath }
            : { path: externalPath };
          yield* Effect.logWarning("Failed to parse external vocabularies, continuing with main ontology only", {
            ...logContext,
            error: String(error),
          });
          return yield* rdfBuilder.createStore;
        })
      )
    );
    const mergedCount = yield* rdfBuilder.mergeStores(mainStore, externalStore);
    const logContext = P.isNotUndefined(contextId)
      ? {
          [contextLabel]: contextId,
          externalPath,
        }
      : { externalPath };
    yield* Effect.logInfo("Merged external vocabularies into ontology", {
      ...logContext,
      newQuadsAdded: mergedCount,
    });
  }
});

/** Minimal RDF query capability consumed by the ontology parser. */
type OntologyQueryService = {
  readonly queryStore: (
    store: RdfStore,
    pattern: {
      readonly subject?: IRI | Subject | null;
      readonly predicate?: IRI | NamedNode | null;
      readonly object?: IRI | ObjectTerm | null;
      readonly graph?: IRI | GraphTerm | null;
    }
  ) => Effect.Effect<Chunk.Chunk<Quad>, RdfError>;
};

type ParsedOntology = {
  readonly classes: Chunk.Chunk<ClassDefinition>;
  readonly properties: Chunk.Chunk<PropertyDefinition>;
  readonly hierarchy: Record<string, Array<IRI>>;
  readonly propertyHierarchy: Record<string, Array<IRI>>;
};

/**
 * Extracts ontology classes, properties, and hierarchies from an RDF store.
 *
 * **Details**
 *
 * Queries canonical RDF terms through the supplied service and preserves the
 * parser's typed failure channel. Both data-first and data-last call forms are
 * supported.
 *
 * **Example** (Inspect the parser API)
 *
 * ```ts
 * import { parseOntologyFromStore } from "@effect-ontology/Service/Ontology"
 *
 * console.log(typeof parseOntologyFromStore) // "function"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseOntologyFromStore: {
  (
    rdf: OntologyQueryService,
    store: RdfStore,
    ontologyPath: string
  ): Effect.Effect<ParsedOntology, OntologyParsingFailed>;
  (
    store: RdfStore,
    ontologyPath: string
  ): (rdf: OntologyQueryService) => Effect.Effect<ParsedOntology, OntologyParsingFailed>;
} = dual3(
  (
    rdf: {
      readonly queryStore: (
        store: RdfStore,
        pattern: {
          readonly subject?: IRI | Subject | null;
          readonly predicate?: IRI | NamedNode | null;
          readonly object?: IRI | ObjectTerm | null;
          readonly graph?: IRI | GraphTerm | null;
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
      // Helper to fetch all values for a predicate into a MutableHashMap
      const fetchPredicateMap = Effect.fn("fetchPredicateMap")(function* (predicate: IRI | NamedNode) {
        const quads = yield* rdf.queryStore(store, { predicate });
        const map = MutableHashMap.empty<string, Array<string>>();
        for (const quad of Chunk.toReadonlyArray(quads)) {
          if (quad.subject.termType === "NamedNode") {
            const subject = quad.subject.value;
            const value = quad.object.value;
            const values = O.getOrElse(MutableHashMap.get(map, subject), () => {
              const created: Array<string> = [];
              MutableHashMap.set(map, subject, created);
              return created;
            });
            values.push(value);
          }
        }
        return map;
      });

      // Helper to wrap predicate fetch with graceful failure handling
      // Returns empty map if the query fails, allowing partial ontology loads
      const fetchPredicateMapSafe = (predicate: IRI | NamedNode) =>
        fetchPredicateMap(predicate).pipe(
          Effect.catch((error) =>
            Effect.gen(function* () {
              yield* Effect.logWarning("Failed to fetch predicate metadata, using empty map", {
                predicate,
                error: String(error),
              });
              return MutableHashMap.empty<string, Array<string>>();
            })
          )
        );

      // Helper to resolve RDF list (used for owl:unionOf)
      const resolveRdfList = (listNode: string): Effect.Effect<Array<string>, RdfError> =>
        Effect.gen(function* () {
          const items: Array<string> = [];
          let current = listNode;

          // Traverse the RDF list (max 100 iterations to prevent infinite loops)
          for (let i = 0; i < 100 && current && current !== namedNodeValue(RDF_NIL); i++) {
            // Get rdf:first (the item at this position)
            const firstQuads = yield* rdf.queryStore(store, {
              subject: makeBlankNode(current),
              predicate: RDF_FIRST,
            });
            for (const q of Chunk.toReadonlyArray(firstQuads)) {
              if (q.object.termType === "NamedNode") {
                items.push(q.object.value);
              }
            }

            // Get rdf:rest (pointer to next list node)
            const restQuads = yield* rdf.queryStore(store, {
              subject: makeBlankNode(current),
              predicate: RDF_REST,
            });
            const restQuad = Chunk.toReadonlyArray(restQuads)[0];
            current = P.isTruthy(restQuad) ? restQuad.object.value : "";
          }

          return items;
        });

      // Helper to resolve blank node union classes (owl:unionOf)
      const resolveBlankNodeUnion = (blankNode: string): Effect.Effect<Array<string>, RdfError> =>
        Effect.gen(function* () {
          // Query for owl:unionOf on this blank node
          const unionQuads = yield* rdf.queryStore(store, {
            subject: makeBlankNode(blankNode),
            predicate: OWL_UNION_OF,
          });

          const members: Array<string> = [];
          for (const q of Chunk.toReadonlyArray(unionQuads)) {
            const listNode = q.object.value;
            const listItems = yield* resolveRdfList(listNode);
            members.push(...listItems);
          }

          return members;
        });

      // Fetch domain/range with blank node union resolution
      const fetchDomainRangeMap = Effect.fn("fetchDomainRangeMap")(function* (predicate: IRI | NamedNode) {
        const quads = yield* rdf.queryStore(store, { predicate });
        const map = MutableHashMap.empty<string, Array<string>>();
        for (const quad of Chunk.toReadonlyArray(quads)) {
          if (quad.subject.termType === "NamedNode") {
            const subject = quad.subject.value;
            const value = quad.object.value;
            const values = O.getOrElse(MutableHashMap.get(map, subject), () => {
              const created: Array<string> = [];
              MutableHashMap.set(map, subject, created);
              return created;
            });
            if (quad.object.termType === "BlankNode") {
              const unionMembers = yield* resolveBlankNodeUnion(value).pipe(Effect.orElseSucceed(() => []));
              values.push(...unionMembers);
            } else {
              values.push(value);
            }
          }
        }
        return map;
      });

      const fetchDomainRangeMapSafe = (predicate: IRI | NamedNode) =>
        fetchDomainRangeMap(predicate).pipe(
          Effect.catch((error) =>
            Effect.gen(function* () {
              yield* Effect.logWarning("Failed to fetch domain/range metadata, using empty map", {
                predicate,
                error: String(error),
              });
              return MutableHashMap.empty<string, Array<string>>();
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
        { concurrency: 5 }
      );

      // Find all classes (subjects where ?s rdf:type owl:Class)
      const classQuads = yield* rdf.queryStore(store, {
        predicate: RDF_TYPE,
        object: OWL_CLASS,
      });

      // Build hierarchy map (child -> parents)
      const hierarchy: Record<string, Array<IRI>> = {};
      for (const [child, parents] of subClassOf) {
        hierarchy[child] = A.map(parents, (parent) => IRI.make(parent));
      }

      // Build property hierarchy map (child -> parents)
      const propertyHierarchy: Record<string, Array<IRI>> = {};
      for (const [child, parents] of subPropertyOf) {
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
      // Store as HashSet<string> for easy lookup by string IDs
      const functionalProps = HashSet.fromIterable(
        Chunk.toReadonlyArray(functionalPropQuads)
          .filter((q) => q.subject.termType === "NamedNode")
          .map((q) => q.subject.value)
      );

      const propInfos = MutableHashMap.empty<
        string,
        {
          id: string;
          rangeType: "object" | "datatype";
        }
      >();
      for (const quad of Chunk.toReadonlyArray(objectPropQuads)) {
        if (quad.subject.termType === "NamedNode") {
          MutableHashMap.set(propInfos, quad.subject.value, { id: quad.subject.value, rangeType: "object" });
        }
      }
      for (const quad of Chunk.toReadonlyArray(datatypePropQuads)) {
        if (quad.subject.termType === "NamedNode") {
          MutableHashMap.set(propInfos, quad.subject.value, { id: quad.subject.value, rangeType: "datatype" });
        }
      }

      // Link props to classes
      const classProperties = MutableHashMap.empty<string, Array<string>>(); // classIRI -> propIRIs
      for (const [propIri, _] of propInfos) {
        const propDomains = O.getOrElse(MutableHashMap.get(domains, propIri), () => []);
        for (const domainIri of propDomains) {
          const properties = O.getOrElse(MutableHashMap.get(classProperties, domainIri), () => {
            const created: Array<string> = [];
            MutableHashMap.set(classProperties, domainIri, created);
            return created;
          });
          properties.push(propIri);
        }
      }

      // RDF store values cross the schema boundary here before entering domain models.
      const asIriArray = (iris: ReadonlyArray<string>): ReadonlyArray<IRI> => A.map(iris, (iri) => IRI.make(iri));

      // Helper to get array with fallback
      const getOrEmpty = (map: MutableHashMap.MutableHashMap<string, Array<string>>, id: string): Array<string> =>
        O.getOrElse(MutableHashMap.get(map, id), () => []);
      const getFirst = (map: MutableHashMap.MutableHashMap<string, Array<string>>, id: string): O.Option<string> =>
        O.flatMap(MutableHashMap.get(map, id), A.head);

      // Finalize Classes
      const finalClasses: Array<ClassDefinition> = [];
      const classSet = MutableHashSet.empty<string>(); // To ensure unique classes
      for (const quad of Chunk.toReadonlyArray(classQuads)) {
        if (quad.subject.termType === "NamedNode") {
          const id = quad.subject.value;
          if (MutableHashSet.has(classSet, id)) continue;
          MutableHashSet.add(classSet, id);

          const label = O.orElse(getFirst(labels, id), () => getFirst(prefLabels, id));
          if (O.isSome(label)) {
            finalClasses.push(
              yield* S.decodeUnknownEffect(ClassDefinition)({
                id: IRI.make(id),
                label: label.value,
                comment: getFirst(comments, id),
                // properties field expects IRI[], coerce from string[]
                properties: asIriArray(getOrEmpty(classProperties, id)),
                prefLabels: getOrEmpty(prefLabels, id),
                altLabels: getOrEmpty(altLabels, id),
                hiddenLabels: getOrEmpty(hiddenLabels, id),
                definition: getFirst(definitions, id),
                scopeNote: getFirst(scopeNotes, id),
                example: getFirst(examples, id),
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
        const label = O.orElse(getFirst(labels, id), () => getFirst(prefLabels, id));
        if (O.isSome(label)) {
          finalProperties.push(
            yield* S.decodeUnknownEffect(PropertyDefinition)({
              id: IRI.make(id),
              label: label.value,
              comment: getFirst(comments, id),
              // domain/range expect string[] (full IRIs as strings)
              domain: asIriArray(getOrEmpty(domains, id)),
              range: asIriArray(getOrEmpty(ranges, id)),
              rangeType: info.rangeType,
              isFunctional: HashSet.has(functionalProps, id),
              prefLabels: getOrEmpty(prefLabels, id),
              altLabels: getOrEmpty(altLabels, id),
              hiddenLabels: getOrEmpty(hiddenLabels, id),
              definition: getFirst(definitions, id),
              scopeNote: getFirst(scopeNotes, id),
              example: getFirst(examples, id),
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
        OntologyParsingFailed.make({
          message: `Failed to parse ontology at ${ontologyPath}`,
          path: FilePath.make(ontologyPath),
          cause: O.some(error),
        })
      )
    )
);

/**
 * OntologyService - Ontology loading using RdfService abstraction
 *
 * **Details**
 *
 * Loads ontology from file, parses using RdfService, and extracts classes/properties
 * using RdfService queries. Backend-agnostic: works with any RDF engine.
 *
 * **Example** (Inspect ontology service)
 *
 * ```ts
 * import { OntologyService } from "@effect-ontology/Service/Ontology"
 *
 * console.log(OntologyService)
 * ```
 *
 * @category layers
 * @since 0.0.0
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
    const cacheTtl = config.ontology.cacheTtl;
    const getOntology = yield* Effect.cachedWithTTL(cacheTtl)(
      Effect.gen(function* () {
        const ontologyPath = config.ontology.path;

        // Load main ontology
        const contentOpt = yield* storage.getOption(ontologyPath).pipe(
          Effect.mapError((error) =>
            OntologyFileNotFound.make({
              message: `Failed to read ontology from storage at ${ontologyPath}`,
              path: FilePath.make(ontologyPath),
              cause: O.some(error),
            })
          )
        );

        if (O.isNone(contentOpt)) {
          return yield* OntologyFileNotFound.make({
            message: `Ontology file not found at ${ontologyPath}`,
            path: FilePath.make(ontologyPath),
          });
        }

        const turtleContent = contentOpt.value;
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
        const { classes, hierarchy, properties, propertyHierarchy } = yield* getOntology;
        const ontology = yield* S.decodeUnknownEffect(OntologyContext)({
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
        const { classes, hierarchy, properties, propertyHierarchy } = yield* getOntology;
        const ontology = yield* S.decodeUnknownEffect(OntologyContext)({
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
      const storagePath = Str.startsWith("gs://")(uri) ? Str.replace(/^gs:\/\/[^/]+\//, "")(uri) : uri;
      const cache = yield* Ref.get(ontologyCacheRef);
      const cached = HashMap.get(cache, uri);
      const now = yield* Clock.currentTimeMillis;
      if (O.isSome(cached) && now - cached.value.loadedAt < cacheTtlMs) {
        yield* Effect.logDebug("Using cached ontology", {
          uri,
          age: now - cached.value.loadedAt,
        });
        return cached.value.data;
      }
      yield* Effect.logInfo("Loading ontology from URI", { uri, storagePath });
      const contentOpt = yield* storage.getOption(storagePath).pipe(
        Effect.mapError((error) =>
          OntologyFileNotFound.make({
            message: `Failed to read ontology from storage at ${uri}`,
            path: FilePath.make(uri),
            cause: O.some(error),
          })
        )
      );
      if (O.isNone(contentOpt)) {
        return yield* OntologyFileNotFound.make({
          message: `Ontology file not found at ${uri}`,
          path: FilePath.make(uri),
        });
      }
      const turtleContent = contentOpt.value;
      const mainStore = yield* rdf.parseTurtle(turtleContent);
      const externalPath = config.ontology.externalVocabsPath;
      yield* loadAndMergeExternalVocabularies(mainStore, externalPath, "uri", uri, storage, rdf);
      const parsed = yield* parseOntologyFromStore(rdf, mainStore, uri);
      yield* Ref.update(ontologyCacheRef, (cache) =>
        HashMap.set(cache, uri, {
          data: parsed,
          loadedAt: now,
        })
      );
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
      if (O.isSome(cached) && now - cached.value.loadedAt < cacheTtlMs) {
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
      const contentOpt = yield* storage.getOption(entry.storagePath).pipe(
        Effect.mapError((error) =>
          OntologyFileNotFound.make({
            message: `Failed to read ontology from storage at ${entry.storagePath}`,
            path: FilePath.make(entry.storagePath),
            cause: O.some(error),
          })
        )
      );
      if (O.isNone(contentOpt)) {
        return yield* OntologyFileNotFound.make({
          message: `Ontology file not found at ${entry.storagePath}`,
          path: FilePath.make(entry.storagePath),
        });
      }
      const turtleContent = contentOpt.value;
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
      yield* Ref.update(ontologyCacheRef, (cache) =>
        HashMap.set(cache, cacheKey, {
          data: parsed,
          loadedAt: now,
        })
      );
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
          Effect.map(({ classes, hierarchy, properties, propertyHierarchy }) =>
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
          Effect.map(({ classes, hierarchy, properties, propertyHierarchy }) =>
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
        if (O.isSome(registryOpt)) {
          const registry = registryOpt.value;
          const entryOpt = yield* registry.resolveToEntry(identifier).pipe(
            Effect.catch((error) =>
              Effect.gen(function* () {
                yield* Effect.logDebug("Registry resolution failed, falling back to direct load", {
                  identifier,
                  error: String(error),
                });
                return O.none<OntologyEntry>();
              })
            )
          );
          if (O.isSome(entryOpt)) {
            const { classes, hierarchy, properties, propertyHierarchy } = yield* loadOntologyFromEntry(entryOpt.value);
            return OntologyContext.make({
              classes: Chunk.toReadonlyArray(classes),
              hierarchy,
              propertyHierarchy,
              properties: Chunk.toReadonlyArray(properties),
            });
          }
        }
        const { classes, hierarchy, properties, propertyHierarchy } = yield* loadOntologyFromUri(identifier);
        return OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties),
        });
      }),
      getRegistryEntry: Effect.fn("OntologyService.getRegistryEntry")(function* (identifier: string) {
        if (O.isNone(registryOpt)) {
          return O.none<OntologyEntry>();
        }
        const registry = registryOpt.value;
        return yield* registry.resolveToEntry(identifier).pipe(Effect.orElseSucceed(() => O.none<OntologyEntry>()));
      }),
      hasRegistry: Effect.succeed(O.isSome(registryOpt)),
      generateVersion: Effect.fn("OntologyService.generateVersion")(function* (
        ontologyId: string,
        ontologyIri: string
      ) {
        const decodeIdentity = <A, I>(schema: S.Codec<A, I>, label: string) =>
          S.decodeUnknownEffect(schema)(ontologyId).pipe(
            Effect.mapError((cause) =>
              OntologyError.make({
                message: `Invalid ontology ${label}: ${ontologyId}`,
                cause: O.some(cause),
              })
            )
          );
        const namespace = yield* decodeIdentity(Namespace, "namespace");
        const name = yield* decodeIdentity(OntologyName, "name");
        const hash = ContentHash.make(createHash("sha256").update(ontologyIri).digest("hex"));
        return OntologyVersion.fromParts(namespace, name, hash);
      }),
      searchClassesHybridFromUri: Effect.fn("OntologyService.searchClassesHybridFromUri")(function* (
        uri: string,
        query: string,
        limit: number = 100
      ) {
        const { classes, hierarchy, properties, propertyHierarchy } = yield* loadOntologyFromUri(uri);
        const ontology = OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties),
        });
        const [bm25Index, semanticIndex] = yield* Effect.all(
          [nlp.createOntologyIndex(ontology), nlp.createOntologySemanticIndex(ontology)],
          { concurrency: 2 }
        );
        const searchLimit = Math.ceil(limit * 0.7);
        const [semanticResults, bm25Results] = yield* Effect.all(
          [
            P.isNotNull(semanticIndex)
              ? Effect.gen(function* () {
                  const results = yield* nlp.searchOntologySemanticIndex(
                    semanticIndex,
                    query,
                    PosInt.make(searchLimit)
                  );
                  const classesMap = MutableHashMap.empty<string, ClassDefinition>();
                  for (const result of results) {
                    if (P.isNotUndefined(result.class)) {
                      MutableHashMap.set(classesMap, result.class.id, result.class);
                    }
                    if (P.isNotUndefined(result.property)) {
                      for (const domainIri of result.property.domain) {
                        const domainClass = ontology.classes.find((c) => c.id === domainIri);
                        if (P.isNotUndefined(domainClass)) {
                          MutableHashMap.set(classesMap, domainClass.id, domainClass);
                        }
                      }
                    }
                  }
                  return Chunk.fromIterable(MutableHashMap.values(classesMap));
                }).pipe(Effect.orElseSucceed(() => Chunk.empty<ClassDefinition>()))
              : Effect.succeed(Chunk.empty<ClassDefinition>()),
            Effect.gen(function* () {
              const results = yield* nlp.searchOntologyIndex(bm25Index, query, PosInt.make(searchLimit));
              const classesMap = MutableHashMap.empty<string, ClassDefinition>();
              for (const result of results) {
                if (P.isNotUndefined(result.class)) {
                  MutableHashMap.set(classesMap, result.class.id, result.class);
                }
                if (P.isNotUndefined(result.property)) {
                  for (const domainIri of result.property.domain) {
                    const domainClass = ontology.classes.find((c) => c.id === domainIri);
                    if (P.isNotUndefined(domainClass)) {
                      MutableHashMap.set(classesMap, domainClass.id, domainClass);
                    }
                  }
                }
              }
              return Chunk.fromIterable(MutableHashMap.values(classesMap));
            }),
          ],
          { concurrency: 2 }
        );
        const semanticArray = Chunk.toReadonlyArray(semanticResults);
        const bm25Array = Chunk.toReadonlyArray(bm25Results);
        const fused = rrfFusion([semanticArray, bm25Array], 60);
        const fusedIds = HashSet.fromIterable(fused.map((r) => r.id));
        const remaining: Array<ClassDefinition> = [];
        if (fused.length < limit && ontology.classes.length <= limit) {
          for (const cls of ontology.classes) {
            if (!HashSet.has(fusedIds, cls.id)) remaining.push(cls);
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
            const { rrfScore: _, ...cls } = r;
            return cls;
          }),
          ...remaining,
        ];
        return Chunk.fromIterable(results.slice(0, limit));
      }),
      getPropertiesForFromUri: Effect.fn("OntologyService.getPropertiesForFromUri")(function* (
        uri: string,
        classIris: ReadonlyArray<string>
      ) {
        const { classes, hierarchy, properties, propertyHierarchy } = yield* loadOntologyFromUri(uri);
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
        const uniqueProps = MutableHashMap.empty<string, PropertyDefinition>();
        for (const prop of props) {
          MutableHashMap.set(uniqueProps, prop.id, prop);
        }
        return Chunk.fromIterable(MutableHashMap.values(uniqueProps));
      }),
      searchClassesHybridFromUriWithEmbeddings: Effect.fn("OntologyService.searchClassesHybridFromUriWithEmbeddings")(
        function* (uri: string, query: string, embeddings: OntologyEmbeddings, limit: number = 100) {
          const { classes, hierarchy, properties, propertyHierarchy } = yield* loadOntologyFromUri(uri);
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
                    const results = yield* nlp.searchOntologySemanticIndex(
                      semanticIndex,
                      query,
                      PosInt.make(searchLimit)
                    );
                    const classesMap = MutableHashMap.empty<string, ClassDefinition>();
                    for (const result of results) {
                      if (P.isNotUndefined(result.class)) {
                        MutableHashMap.set(classesMap, result.class.id, result.class);
                      }
                      if (P.isNotUndefined(result.property)) {
                        for (const domainIri of result.property.domain) {
                          const domainClass = ontology.classes.find((c) => c.id === domainIri);
                          if (P.isNotUndefined(domainClass)) {
                            MutableHashMap.set(classesMap, domainClass.id, domainClass);
                          }
                        }
                      }
                    }
                    return Chunk.fromIterable(MutableHashMap.values(classesMap));
                  }).pipe(Effect.orElseSucceed(() => Chunk.empty<ClassDefinition>()))
                : Effect.succeed(Chunk.empty<ClassDefinition>()),
              Effect.gen(function* () {
                const results = yield* nlp.searchOntologyIndex(bm25Index, query, PosInt.make(searchLimit));
                const classesMap = MutableHashMap.empty<string, ClassDefinition>();
                for (const result of results) {
                  if (P.isNotUndefined(result.class)) {
                    MutableHashMap.set(classesMap, result.class.id, result.class);
                  }
                  if (P.isNotUndefined(result.property)) {
                    for (const domainIri of result.property.domain) {
                      const domainClass = ontology.classes.find((c) => c.id === domainIri);
                      if (P.isNotUndefined(domainClass)) {
                        MutableHashMap.set(classesMap, domainClass.id, domainClass);
                      }
                    }
                  }
                }
                return Chunk.fromIterable(MutableHashMap.values(classesMap));
              }),
            ],
            { concurrency: 2 }
          );
          const semanticArray = Chunk.toReadonlyArray(semanticResults);
          const bm25Array = Chunk.toReadonlyArray(bm25Results);
          const fused = rrfFusion([semanticArray, bm25Array], 60);
          const fusedIds = HashSet.fromIterable(fused.map((r) => r.id));
          const remaining: Array<ClassDefinition> = [];
          if (fused.length < limit && ontology.classes.length <= limit) {
            for (const cls of ontology.classes) {
              if (!HashSet.has(fusedIds, cls.id)) remaining.push(cls);
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
              const { rrfScore: _, ...cls } = r;
              return cls;
            }),
            ...remaining,
          ];
          return Chunk.fromIterable(results.slice(0, limit));
        }
      ),
      ontology: Effect.gen(function* () {
        const { classes, hierarchy, properties, propertyHierarchy } = yield* getOntology;
        return OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties),
        });
      }),
      searchClasses: Effect.fn("OntologyService.searchClasses")(function* (query: string, limit: number = 10) {
        const { classes, hierarchy, properties, propertyHierarchy } = yield* getOntology;
        const ontology = OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties),
        });
        const index = yield* getBm25Index;
        const results = yield* nlp.searchOntologyIndex(index, query, PosInt.make(limit));
        const validClasses = MutableHashMap.empty<string, ClassDefinition>();
        for (const result of results) {
          if (P.isNotUndefined(result.class)) {
            MutableHashMap.set(validClasses, result.class.id, result.class);
          }
          if (P.isNotUndefined(result.property)) {
            for (const domainIri of result.property.domain) {
              const domainClass = ontology.classes.find((c) => c.id === domainIri);
              if (P.isNotUndefined(domainClass)) {
                MutableHashMap.set(validClasses, domainClass.id, domainClass);
              }
            }
          }
        }
        return Chunk.fromIterable(MutableHashMap.values(validClasses));
      }),
      searchProperties: Effect.fn("OntologyService.searchProperties")(function* (query: string, limit: number = 10) {
        const index = yield* getBm25Index;
        const results = yield* nlp.searchOntologyIndex(index, query, PosInt.make(limit));
        return Chunk.fromIterable(results.filter((r) => r.property !== undefined).map((r) => r.property));
      }),
      getPropertiesFor: Effect.fn("OntologyService.getPropertiesFor")(function* (classIris: ReadonlyArray<string>) {
        const { classes, hierarchy, properties, propertyHierarchy } = yield* getOntology;
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
        const uniqueProps = MutableHashMap.empty<string, PropertyDefinition>();
        for (const prop of props) {
          MutableHashMap.set(uniqueProps, prop.id, prop);
        }
        return Chunk.fromIterable(MutableHashMap.values(uniqueProps));
      }),
      searchClassesSemantic: Effect.fn("OntologyService.searchClassesSemantic")(function* (
        query: string,
        limit: number = 10
      ) {
        const { classes, hierarchy, properties, propertyHierarchy } = yield* getOntology;
        const ontology = OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties),
        });
        const index = yield* getSemanticIndex;
        const results = yield* nlp.searchOntologySemanticIndex(index, query, PosInt.make(limit));
        const validClasses = MutableHashMap.empty<string, ClassDefinition>();
        for (const result of results) {
          if (P.isNotUndefined(result.class)) {
            MutableHashMap.set(validClasses, result.class.id, result.class);
          }
          if (P.isNotUndefined(result.property)) {
            for (const domainIri of result.property.domain) {
              const domainClass = ontology.classes.find((c) => c.id === domainIri);
              if (P.isNotUndefined(domainClass)) {
                MutableHashMap.set(validClasses, domainClass.id, domainClass);
              }
            }
          }
        }
        return Chunk.fromIterable(MutableHashMap.values(validClasses));
      }),
      searchPropertiesSemantic: Effect.fn("OntologyService.searchPropertiesSemantic")(function* (
        query: string,
        limit: number = 10
      ) {
        const index = yield* getSemanticIndex;
        const results = yield* nlp.searchOntologySemanticIndex(index, query, PosInt.make(limit));
        return Chunk.fromIterable(results.filter((r) => r.property !== undefined).map((r) => r.property));
      }),
      searchClassesHybrid: Effect.fn("OntologyService.searchClassesHybrid")(function* (
        query: string,
        limit: number = 100
      ) {
        const { classes, hierarchy, properties, propertyHierarchy } = yield* getOntology;
        const ontology = yield* S.decodeUnknownEffect(OntologyContext)({
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
              const results = yield* nlp.searchOntologySemanticIndex(semanticIndex, query, PosInt.make(searchLimit));
              const classesMap = MutableHashMap.empty<string, ClassDefinition>();
              for (const result of results) {
                if (P.isNotUndefined(result.class)) {
                  MutableHashMap.set(classesMap, result.class.id, result.class);
                }
                if (P.isNotUndefined(result.property)) {
                  for (const domainIri of result.property.domain) {
                    const domainClass = ontology.classes.find((c) => c.id === domainIri);
                    if (P.isNotUndefined(domainClass)) {
                      MutableHashMap.set(classesMap, domainClass.id, domainClass);
                    }
                  }
                }
              }
              return Chunk.fromIterable(MutableHashMap.values(classesMap));
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
              const results = yield* nlp.searchOntologyIndex(bm25Index, query, PosInt.make(searchLimit));
              const classesMap = MutableHashMap.empty<string, ClassDefinition>();
              for (const result of results) {
                if (P.isNotUndefined(result.class)) {
                  MutableHashMap.set(classesMap, result.class.id, result.class);
                }
                if (P.isNotUndefined(result.property)) {
                  for (const domainIri of result.property.domain) {
                    const domainClass = ontology.classes.find((c) => c.id === domainIri);
                    if (P.isNotUndefined(domainClass)) {
                      MutableHashMap.set(classesMap, domainClass.id, domainClass);
                    }
                  }
                }
              }
              return Chunk.fromIterable(MutableHashMap.values(classesMap));
            }),
          ],
          { concurrency: 2 }
        );
        const semanticArray = Chunk.toReadonlyArray(semanticResults);
        const bm25Array = Chunk.toReadonlyArray(bm25Results);
        const fused = rrfFusion([semanticArray, bm25Array], 60);
        const fusedIds = HashSet.fromIterable(fused.map((r) => r.id));
        const remaining: Array<ClassDefinition> = [];
        if (fused.length < limit && ontology.classes.length <= limit) {
          for (const cls of ontology.classes) {
            if (!HashSet.has(fusedIds, cls.id)) remaining.push(cls);
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
        const fusedClasses = A.flatMap(fused, (result) =>
          O.toArray(A.findFirst(ontology.classes, (candidate) => candidate.id === result.id))
        );
        return Chunk.fromIterable(A.take(A.appendAll(fusedClasses, remaining), limit));
      }),
      searchClassesHybridWithEmbeddings: Effect.fn("OntologyService.searchClassesHybridWithEmbeddings")(function* (
        query: string,
        embeddings: OntologyEmbeddings,
        limit: number = 100
      ) {
        const { classes, hierarchy, properties, propertyHierarchy } = yield* getOntology;
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
              const results = yield* nlp.searchOntologySemanticIndex(semanticIndex, query, PosInt.make(searchLimit));
              const classesMap = MutableHashMap.empty<string, ClassDefinition>();
              for (const result of results) {
                if (P.isNotUndefined(result.class)) {
                  MutableHashMap.set(classesMap, result.class.id, result.class);
                }
                if (P.isNotUndefined(result.property)) {
                  for (const domainIri of result.property.domain) {
                    const domainClass = ontology.classes.find((c) => c.id === domainIri);
                    if (P.isNotUndefined(domainClass)) {
                      MutableHashMap.set(classesMap, domainClass.id, domainClass);
                    }
                  }
                }
              }
              return Chunk.fromIterable(MutableHashMap.values(classesMap));
            }).pipe(
              Effect.catch(
                Effect.fn(function* (error) {
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
              const results = yield* nlp.searchOntologyIndex(bm25Index, query, PosInt.make(searchLimit));
              const classesMap = MutableHashMap.empty<string, ClassDefinition>();
              for (const result of results) {
                if (P.isNotUndefined(result.class)) {
                  MutableHashMap.set(classesMap, result.class.id, result.class);
                }
                if (P.isNotUndefined(result.property)) {
                  for (const domainIri of result.property.domain) {
                    const domainClass = ontology.classes.find((c) => c.id === domainIri);
                    if (P.isNotUndefined(domainClass)) {
                      MutableHashMap.set(classesMap, domainClass.id, domainClass);
                    }
                  }
                }
              }
              return Chunk.fromIterable(MutableHashMap.values(classesMap));
            }),
          ],
          { concurrency: 2 }
        );
        const semanticArray = Chunk.toReadonlyArray(semanticResults);
        const bm25Array = Chunk.toReadonlyArray(bm25Results);
        const fused = rrfFusion([semanticArray, bm25Array], 60);
        const fusedIds = HashSet.fromIterable(fused.map((r) => r.id));
        const remaining: Array<ClassDefinition> = [];
        if (fused.length < limit && ontology.classes.length <= limit) {
          for (const cls of ontology.classes) {
            if (!HashSet.has(fusedIds, cls.id)) remaining.push(cls);
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
            const { rrfScore: _, ...cls } = r;
            return cls;
          }),
          ...remaining,
        ];
        return Chunk.fromIterable(results.slice(0, limit));
      }),
      getClassHierarchyChecker: Effect.fn("OntologyService.getClassHierarchyChecker")(function* () {
        const { classes, hierarchy, properties, propertyHierarchy } = yield* getOntology;
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
