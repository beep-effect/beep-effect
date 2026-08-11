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

import { createHash } from "crypto"
import { Chunk, Duration, Effect, HashMap, Option, Ref, Context, Layer } from "effect"
import * as A from "effect/Array"
import { OntologyFileNotFound, OntologyParsingFailed } from "../Domain/Error/Ontology.ts"
import type { RdfError } from "../Domain/Error/Rdf.ts"
import type { OntologyVersion } from "../Domain/Identity.ts"
import { ClassDefinition, OntologyContext, PropertyDefinition } from "../Domain/Model/Ontology.ts"
import type { OntologyEmbeddings } from "../Domain/Model/OntologyEmbeddings.ts"
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
  SKOS_SCOPENOTE
} from "../Domain/Rdf/Constants.ts"
import { IRI, Literal, type Quad } from "../Domain/Rdf/Types.ts"
import type { OntologyEntry } from "../Domain/Schema/OntologyRegistry.ts"
import { rrfFusion } from "../Utils/Retrieval.ts"
import { ConfigService } from "./Config.ts"
import { NlpService } from "./Nlp.ts"
import { OntologyRegistryService } from "./OntologyRegistry.ts"
import { RdfBuilder, type RdfStore } from "./Rdf.ts"
import { StorageService } from "./Storage.ts"
import { $ScratchpadId } from "@beep/identity";
import * as O from "effect/Option";
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
const loadAndMergeExternalVocabularies = (
  mainStore: RdfStore,
  externalPath: string,
  contextLabel: string,
  contextId?: string,
  storage?: StorageService["Service"],
  rdf?: RdfBuilder["Service"]
) =>
  Effect.gen(function*() {
    const storageService = storage ?? (yield* StorageService)
    const rdfBuilder = rdf ?? (yield* RdfBuilder)

    const externalContentOpt = yield* storageService.get(externalPath).pipe(
      Effect.catch((error) =>
        Effect.gen(function*() {
          const logContext = contextId ? { [contextLabel]: contextId, path: externalPath } : { path: externalPath }
          yield* Effect.logWarning("Failed to load external vocabularies, continuing with main ontology only", {
            ...logContext,
            error: String(error)
          })
          return Option.none<string>()
        })
      )
    )

    if (Option.isSome(externalContentOpt)) {
      const externalStore = yield* rdfBuilder.parseTurtle(externalContentOpt.value).pipe(
        Effect.catch((error) =>
          Effect.gen(function*() {
            const logContext = contextId ? { [contextLabel]: contextId, path: externalPath } : { path: externalPath }
            yield* Effect.logWarning("Failed to parse external vocabularies, continuing with main ontology only", {
              ...logContext,
              error: String(error)
            })
            return yield* rdfBuilder.createStore
          })
        )
      )

      const mergedCount = yield* rdfBuilder.mergeStores(mainStore, externalStore)
      const logContext = contextId ? { [contextLabel]: contextId, externalPath } : { externalPath }
      yield* Effect.logInfo("Merged external vocabularies into ontology", {
        ...logContext,
        newQuadsAdded: mergedCount
      })
    }
  })

/**
 * Parse ontology from RDF store using RdfService queries
 *
 * Uses RdfService's queryStore to extract classes and properties.
 * Works with domain types (IRI, Quad) instead of N3 types.
 */
export const parseOntologyFromStore = (
  rdf: {
    readonly queryStore: (
      store: RdfStore,
      pattern: {
        readonly subject?: IRI | null
        readonly predicate?: IRI | null
        readonly object?: IRI | null
        readonly graph?: IRI | null
      }
    ) => Effect.Effect<Chunk.Chunk<Quad>, RdfError>
  },
  store: RdfStore,
  ontologyPath: string
): Effect.Effect<
  {
    classes: Chunk.Chunk<ClassDefinition>
    properties: Chunk.Chunk<PropertyDefinition>
    hierarchy: Record<string, Array<IRI>>
    propertyHierarchy: Record<string, Array<IRI>>
  },
  OntologyParsingFailed
> =>
  Effect.gen(function*() {
    // Helper to fetch all values for a predicate into a Map
    const fetchPredicateMap = (predicate: IRI) =>
      Effect.gen(function*() {
        const quads = yield* rdf.queryStore(store, { predicate })
        const map = new Map<string, Array<string>>()
        for (const quad of Chunk.toReadonlyArray(quads)) {
          if (typeof quad.subject === "string" && !quad.subject.startsWith("_:")) {
            const subject = quad.subject
            const value = quad.object instanceof Literal ? quad.object.value : (quad.object as string)
            if (!map.has(subject)) {
              map.set(subject, [])
            }
            map.get(subject)!.push(value)
          }
        }
        return map
      })

    // Helper to wrap predicate fetch with graceful failure handling
    // Returns empty map if the query fails, allowing partial ontology loads
    const fetchPredicateMapSafe = (predicate: IRI) =>
      fetchPredicateMap(predicate).pipe(
        Effect.catch((error) =>
          Effect.gen(function*() {
            yield* Effect.logWarning("Failed to fetch predicate metadata, using empty map", {
              predicate,
              error: String(error)
            })
            return new Map<string, Array<string>>()
          })
        )
      )

    // Helper to resolve RDF list (used for owl:unionOf)
    const resolveRdfList = (listNode: string): Effect.Effect<Array<string>, RdfError> =>
      Effect.gen(function*() {
        const items: Array<string> = []
        let current = listNode

        // Traverse the RDF list (max 100 iterations to prevent infinite loops)
        for (let i = 0; i < 100 && current && current !== RDF.nil; i++) {
          // Get rdf:first (the item at this position)
          const firstQuads = yield* rdf.queryStore(store, {
            subject: current as IRI,
            predicate: RDF.first
          })
          for (const q of Chunk.toReadonlyArray(firstQuads)) {
            const value = q.object instanceof Literal ? q.object.value : (q.object as string)
            // Only include named nodes (not blank nodes)
            if (typeof value === "string" && !value.startsWith("_:")) {
              items.push(value)
            }
          }

          // Get rdf:rest (pointer to next list node)
          const restQuads = yield* rdf.queryStore(store, {
            subject: current as IRI,
            predicate: RDF.rest
          })
          const restQuad = Chunk.toReadonlyArray(restQuads)[0]
          current = restQuad
            ? (restQuad.object instanceof Literal ? restQuad.object.value : (restQuad.object as string))
            : ""
        }

        return items
      })

    // Helper to resolve blank node union classes (owl:unionOf)
    const resolveBlankNodeUnion = (blankNode: string): Effect.Effect<Array<string>, RdfError> =>
      Effect.gen(function*() {
        // Query for owl:unionOf on this blank node
        const unionQuads = yield* rdf.queryStore(store, {
          subject: blankNode as IRI,
          predicate: OWL.unionOf
        })

        const members: Array<string> = []
        for (const q of Chunk.toReadonlyArray(unionQuads)) {
          const listNode = q.object instanceof Literal ? q.object.value : (q.object as string)
          const listItems = yield* resolveRdfList(listNode)
          members.push(...listItems)
        }

        return members
      })

    // Fetch domain/range with blank node union resolution
    const fetchDomainRangeMap = (predicate: IRI) =>
      Effect.gen(function*() {
        const quads = yield* rdf.queryStore(store, { predicate })
        const map = new Map<string, Array<string>>()

        for (const quad of Chunk.toReadonlyArray(quads)) {
          if (typeof quad.subject === "string" && !quad.subject.startsWith("_:")) {
            const subject = quad.subject
            const value = quad.object instanceof Literal ? quad.object.value : (quad.object as string)

            if (!map.has(subject)) {
              map.set(subject, [])
            }

            // If the object is a blank node, resolve it as a union
            if (typeof value === "string" && value.startsWith("_:")) {
              const unionMembers = yield* resolveBlankNodeUnion(value).pipe(
                Effect.catch(() => Effect.succeed([] as Array<string>))
              )
              map.get(subject)!.push(...unionMembers)
            } else {
              map.get(subject)!.push(value)
            }
          }
        }
        return map
      })

    const fetchDomainRangeMapSafe = (predicate: IRI) =>
      fetchDomainRangeMap(predicate).pipe(
        Effect.catch((error) =>
          Effect.gen(function*() {
            yield* Effect.logWarning("Failed to fetch domain/range metadata, using empty map", {
              predicate,
              error: String(error)
            })
            return new Map<string, Array<string>>()
          })
        )
      )

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
      equivalentClasses
    ] = yield* Effect.all([
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
      fetchPredicateMapSafe(OWL_EQUIVALENT_CLASS)
    ], { concurrency: 5 })

    // Find all classes (subjects where ?s rdf:type owl:Class)
    const classQuads = yield* rdf.queryStore(store, {
      predicate: RDF_TYPE,
      object: OWL_CLASS
    })

    // Build hierarchy map (child -> parents)
    const hierarchy: Record<string, Array<IRI>> = {}
    for (const [child, parents] of subClassOf.entries()) {
      hierarchy[child] = A.map(parents, (parent) => IRI.make(parent))
    }

    // Build property hierarchy map (child -> parents)
    const propertyHierarchy: Record<string, Array<IRI>> = {}
    for (const [child, parents] of subPropertyOf.entries()) {
      propertyHierarchy[child] = A.map(parents, (parent) => IRI.make(parent))
    }

    // Process Properties
    const objectPropQuads = yield* rdf.queryStore(store, {
      predicate: RDF_TYPE,
      object: OWL_OBJECT_PROPERTY
    })
    const datatypePropQuads = yield* rdf.queryStore(store, {
      predicate: RDF_TYPE,
      object: OWL_DATATYPE_PROPERTY
    })
    const functionalPropQuads = yield* rdf.queryStore(store, {
      predicate: RDF_TYPE,
      object: OWL_FUNCTIONAL_PROPERTY
    })
    // Store as Set<string> for easy lookup by string IDs
    const functionalProps = new Set<string>(
      Chunk.toReadonlyArray(functionalPropQuads)
        .filter((q) => typeof q.subject === "string")
        .map((q) => q.subject as string)
    )

    const propInfos = new Map<string, { id: string; rangeType: "object" | "datatype" }>()
    for (const quad of Chunk.toReadonlyArray(objectPropQuads)) {
      if (typeof quad.subject === "string" && !quad.subject.startsWith("_:")) {
        propInfos.set(quad.subject, { id: quad.subject, rangeType: "object" })
      }
    }
    for (const quad of Chunk.toReadonlyArray(datatypePropQuads)) {
      if (typeof quad.subject === "string" && !quad.subject.startsWith("_:")) {
        propInfos.set(quad.subject, { id: quad.subject, rangeType: "datatype" })
      }
    }

    // Link props to classes
    const classProperties = new Map<string, Array<string>>() // classIRI -> propIRIs
    for (const [propIri, _] of propInfos) {
      const propDomains = domains.get(propIri) || []
      for (const domainIri of propDomains) {
        if (!classProperties.has(domainIri)) {
          classProperties.set(domainIri, [])
        }
        classProperties.get(domainIri)!.push(propIri)
      }
    }

    // RDF store values cross the schema boundary here before entering domain models.
    const asIriArray = (iris: ReadonlyArray<string>): ReadonlyArray<IRI> =>
      A.map(iris, (iri) => IRI.make(iri))

    // Helper to get array with fallback
    const getOrEmpty = (map: Map<string, Array<string>>, id: string): Array<string> => map.get(id) || []

    // Finalize Classes
    const finalClasses: Array<ClassDefinition> = []
    const classSet = new Set<string>() // To ensure unique classes
    for (const quad of Chunk.toReadonlyArray(classQuads)) {
      if (typeof quad.subject === "string" && !quad.subject.startsWith("_:")) {
        const id = quad.subject
        if (classSet.has(id)) continue
        classSet.add(id)

        if ((labels.get(id)?.[0] || prefLabels.get(id)?.[0])) {
          finalClasses.push(
            ClassDefinition.make({
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
              equivalentClass: asIriArray(getOrEmpty(equivalentClasses, id))
            })
          )
        }
      }
    }

    // Finalize Properties
    const finalProperties: Array<PropertyDefinition> = []
    for (const [id, info] of propInfos) {
      if ((labels.get(id)?.[0] || prefLabels.get(id)?.[0])) {
        finalProperties.push(
          PropertyDefinition.make({
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
            inverseOf: asIriArray(getOrEmpty(inverseOfs, id))
          })
        )
      }
    }

    return {
      classes: Chunk.fromIterable(finalClasses),
      properties: Chunk.fromIterable(finalProperties),
      hierarchy,
      propertyHierarchy
    }
  }).pipe(
    Effect.mapError(
      (error) =>
        OntologyParsingFailed.make({
          message: `Failed to parse ontology at ${ontologyPath}`,
          path: ontologyPath,
          cause: O.some(error)
        })
    )
  )

/**
 * OntologyService - Ontology loading using RdfService abstraction
 *
 * Loads ontology from file, parses using RdfService, and extracts classes/properties
 * using RdfService queries. Backend-agnostic: works with any RDF engine.
 *
 * @since 2.0.0
 * @category Services
 */
export class OntologyService extends Context.Service<OntologyService>()(
  $I`OntologyService`,
  {
    make: Effect.gen(function*() {
      const config = yield* ConfigService
      const storage = yield* StorageService
      const rdf = yield* RdfBuilder
      const nlp = yield* NlpService
      // Registry is optional - only available when ONTOLOGY.REGISTRY_PATH is configured
      const registryOpt = yield* Effect.serviceOption(OntologyRegistryService)

      // Cache ontology with configurable TTL to allow refresh without restart
      const cacheTtl = Duration.seconds(config.ontology.cacheTtlSeconds)
      const getOntology = yield* Effect.cachedWithTTL(cacheTtl)(
        Effect.gen(function*() {
          const ontologyPath = config.ontology.path

          // Load main ontology
          const contentOpt = yield* storage.get(ontologyPath).pipe(
            Effect.mapError(
              (error) =>
                OntologyFileNotFound.make({
                  message: `Failed to read ontology from storage at ${ontologyPath}`,
                  path: ontologyPath,
                  cause: O.some(error)
                })
            )
          )

          if ((contentOpt === undefined)) {
            return yield* Effect.fail(
              OntologyFileNotFound.make({
                message: `Ontology file not found at ${ontologyPath}`,
                path: ontologyPath
              })
            )
          }

          const turtleContent = contentOpt
          const mainStore = yield* rdf.parseTurtle(turtleContent)

          // Load and merge external vocabularies (PROV-O, W3C ORG, etc.)
          const externalPath = config.ontology.externalVocabsPath
          yield* loadAndMergeExternalVocabularies(mainStore, externalPath, "main", undefined, storage, rdf)

          return yield* parseOntologyFromStore(
            rdf,
            mainStore,
            ontologyPath
          )
        })
      )

      // Cache BM25 index with same TTL as ontology to stay in sync
      const getBm25Index = yield* Effect.cachedWithTTL(cacheTtl)(
        Effect.gen(function*() {
          const { classes, hierarchy, properties, propertyHierarchy } = yield* getOntology
          const ontology = OntologyContext.make({
            classes: Chunk.toReadonlyArray(classes),
            hierarchy,
            propertyHierarchy,
            properties: Chunk.toReadonlyArray(properties)
          })
          return yield* nlp.createOntologyIndex(ontology)
        })
      )

      // Cache Semantic index with same TTL as ontology to stay in sync
      const getSemanticIndex = yield* Effect.cachedWithTTL(cacheTtl)(
        Effect.gen(function*() {
          const { classes, hierarchy, properties, propertyHierarchy } = yield* getOntology
          const ontology = OntologyContext.make({
            classes: Chunk.toReadonlyArray(classes),
            hierarchy,
            propertyHierarchy,
            properties: Chunk.toReadonlyArray(properties)
          })
          return yield* nlp.createOntologySemanticIndex(ontology)
        })
      )

      // Per-URI ontology cache for multi-ontology support
      // Each ontology is cached with timestamp for TTL-based expiration
      type CachedOntology = {
        readonly data: {
          readonly classes: Chunk.Chunk<ClassDefinition>
          readonly properties: Chunk.Chunk<PropertyDefinition>
          readonly hierarchy: Record<string, Array<IRI>>
          readonly propertyHierarchy: Record<string, Array<IRI>>
        }
        readonly loadedAt: number
      }
      const ontologyCacheRef = yield* Ref.make(HashMap.empty<string, CachedOntology>())
      const cacheTtlMs = Duration.toMillis(cacheTtl)

      /**
       * Load ontology from a specific URI with per-URI caching.
       * This enables multi-ontology deployments where each request
       * can specify its own ontology (e.g., Seattle, Wikipedia, etc.)
       */
      const loadOntologyFromUri = (uri: string) =>
        Effect.gen(function*() {
          // Normalize URI - strip gs:// prefix if present for storage access
          const storagePath = uri.startsWith("gs://")
            ? uri.replace(/^gs:\/\/[^/]+\//, "")
            : uri

          // Check cache first
          const cache = yield* Ref.get(ontologyCacheRef)
          const cached = HashMap.get(cache, uri)
          const now = Date.now()

          if (Option.isSome(cached) && (now - cached.value.loadedAt) < cacheTtlMs) {
            yield* Effect.logDebug("Using cached ontology", { uri, age: now - cached.value.loadedAt })
            return cached.value.data
          }

          // Load from storage
          yield* Effect.logInfo("Loading ontology from URI", { uri, storagePath })
          const contentOpt = yield* storage.get(storagePath).pipe(
            Effect.mapError(
              (error) =>
                OntologyFileNotFound.make({
                  message: `Failed to read ontology from storage at ${uri}`,
                  path: uri,
                  cause: O.some(error)
                })
            )
          )

          if ((contentOpt === undefined)) {
            return yield* Effect.fail(
              OntologyFileNotFound.make({
                message: `Ontology file not found at ${uri}`,
                path: uri
              })
            )
          }

          const turtleContent = contentOpt
          const mainStore = yield* rdf.parseTurtle(turtleContent)

          // Merge external vocabularies (PROV-O, W3C ORG, FOAF, etc.)
          const externalPath = config.ontology.externalVocabsPath
          yield* loadAndMergeExternalVocabularies(mainStore, externalPath, "uri", uri, storage, rdf)

          const parsed = yield* parseOntologyFromStore(rdf, mainStore, uri)

          // Update cache
          yield* Ref.update(ontologyCacheRef, (cache) => HashMap.set(cache, uri, { data: parsed, loadedAt: now }))

          yield* Effect.logInfo("Ontology loaded and cached", {
            uri,
            classCount: Chunk.size(parsed.classes),
            propertyCount: Chunk.size(parsed.properties)
          })

          return parsed
        })

      /**
       * Load ontology from a registry entry with proper external vocab handling
       */
      const loadOntologyFromEntry = (entry: OntologyEntry) =>
        Effect.gen(function*() {
          const cacheKey = entry.iri // Use IRI as cache key for registry-based loads

          // Check cache first
          const cache = yield* Ref.get(ontologyCacheRef)
          const cached = HashMap.get(cache, cacheKey)
          const now = Date.now()

          if (Option.isSome(cached) && (now - cached.value.loadedAt) < cacheTtlMs) {
            yield* Effect.logDebug("Using cached ontology from registry", {
              id: entry.id,
              iri: entry.iri,
              age: now - cached.value.loadedAt
            })
            return cached.value.data
          }

          // Load main ontology
          yield* Effect.logInfo("Loading ontology from registry entry", {
            id: entry.id,
            iri: entry.iri,
            storagePath: entry.storagePath
          })
          const contentOpt = yield* storage.get(entry.storagePath).pipe(
            Effect.mapError(
              (error) =>
                OntologyFileNotFound.make({
                  message: `Failed to read ontology from storage at ${entry.storagePath}`,
                  path: entry.storagePath,
                  cause: O.some(error)
                })
            )
          )

          if ((contentOpt === undefined)) {
            return yield* Effect.fail(
              OntologyFileNotFound.make({
                message: `Ontology file not found at ${entry.storagePath}`,
                path: entry.storagePath
              })
            )
          }

          const turtleContent = contentOpt
          const mainStore = yield* rdf.parseTurtle(turtleContent)

          // Merge external vocabularies if specified in entry
          if (entry.externalVocabsPath) {
            yield* loadAndMergeExternalVocabularies(
              mainStore,
              entry.externalVocabsPath,
              "entryId",
              entry.id,
              storage,
              rdf
            )
          }

          const parsed = yield* parseOntologyFromStore(rdf, mainStore, entry.storagePath)

          // Update cache
          yield* Ref.update(ontologyCacheRef, (cache) => HashMap.set(cache, cacheKey, { data: parsed, loadedAt: now }))

          yield* Effect.logInfo("Ontology loaded from registry and cached", {
            id: entry.id,
            iri: entry.iri,
            classCount: Chunk.size(parsed.classes),
            propertyCount: Chunk.size(parsed.properties)
          })

          return parsed
        })

      return {
        /**
         * Load ontology from a specific URI with caching
         *
         * Enables multi-ontology deployments where each request can specify
         * its own ontology. Caches per-URI with TTL-based expiration.
         *
         * @param uri - Ontology URI (gs:// or storage-relative path)
         * @returns Parsed ontology context
         *
         * @example
         * ```typescript
         * const ontology = yield* OntologyService.loadFromUri("gs://bucket/seattle/ontology.ttl")
         * ```
         */
        loadFromUri: (uri: string) =>
          loadOntologyFromUri(uri).pipe(
            Effect.map(({ classes, hierarchy, properties, propertyHierarchy }) =>
              OntologyContext.make({
                classes: Chunk.toReadonlyArray(classes),
                hierarchy,
                propertyHierarchy,
                properties: Chunk.toReadonlyArray(properties)
              })
            )
          ),

        /**
         * Load ontology from a registry entry
         *
         * Uses the registry entry's metadata to load the ontology with proper
         * external vocabulary handling. Caches by IRI with TTL-based expiration.
         *
         * @param entry - OntologyEntry from the registry
         * @returns Parsed ontology context
         *
         * @example
         * ```typescript
         * const entry = yield* OntologyRegistryService.getById("seattle")
         * if (Option.isSome(entry)) {
         *   const ontology = yield* OntologyService.loadFromRegistryEntry(entry.value)
         * }
         * ```
         */
        loadFromRegistryEntry: (entry: OntologyEntry) =>
          loadOntologyFromEntry(entry).pipe(
            Effect.map(({ classes, hierarchy, properties, propertyHierarchy }) =>
              OntologyContext.make({
                classes: Chunk.toReadonlyArray(classes),
                hierarchy,
                propertyHierarchy,
                properties: Chunk.toReadonlyArray(properties)
              })
            )
          ),

        /**
         * Resolve ontology identifier via registry and load
         *
         * Accepts ontology ID, IRI, or direct path. Uses registry to resolve
         * to storage path and loads with proper external vocab handling.
         *
         * @param identifier - Ontology ID ("seattle"), IRI ("http://..."), or path
         * @returns Parsed ontology context
         *
         * @example
         * ```typescript
         * // By ID
         * const ontology = yield* (yield* OntologyService).resolveAndLoad("seattle")
         * // By IRI
         * const ontology = yield* (yield* OntologyService).resolveAndLoad("http://effect-ontology.dev/seattle")
         * // By path (falls back to direct load)
         * const ontology = yield* (yield* OntologyService).resolveAndLoad("canonical/seattle/ontology.ttl")
         * ```
         */
        resolveAndLoad: (identifier: string) =>
          Effect.gen(function*() {
            // Try registry first if available
            if (Option.isSome(registryOpt)) {
              const registry = registryOpt.value
              const entryOpt = yield* registry.resolveToEntry(identifier).pipe(
                Effect.catch((error) =>
                  Effect.gen(function*() {
                    yield* Effect.logDebug("Registry resolution failed, falling back to direct load", {
                      identifier,
                      error: String(error)
                    })
                    return Option.none<OntologyEntry>()
                  })
                )
              )

              if (Option.isSome(entryOpt)) {
                const { classes, hierarchy, properties, propertyHierarchy } = yield* loadOntologyFromEntry(
                  entryOpt.value
                )
                return OntologyContext.make({
                  classes: Chunk.toReadonlyArray(classes),
                  hierarchy,
                  propertyHierarchy,
                  properties: Chunk.toReadonlyArray(properties)
                })
              }
            }

            // Fall back to direct URI loading
            const { classes, hierarchy, properties, propertyHierarchy } = yield* loadOntologyFromUri(identifier)
            return OntologyContext.make({
              classes: Chunk.toReadonlyArray(classes),
              hierarchy,
              propertyHierarchy,
              properties: Chunk.toReadonlyArray(properties)
            })
          }),

        /**
         * Get registry entry for an ontology identifier
         *
         * Returns the registry entry if registry is available and the identifier
         * resolves to an entry. Returns None if registry is not configured or
         * identifier is not found.
         *
         * @param identifier - Ontology ID, IRI, or path
         * @returns Option<OntologyEntry>
         */
        getRegistryEntry: (identifier: string) =>
          Effect.gen(function*() {
            if (Option.isNone(registryOpt)) {
              return Option.none<OntologyEntry>()
            }
            const registry = registryOpt.value
            return yield* registry.resolveToEntry(identifier).pipe(
              Effect.catch(() => Effect.succeed(Option.none<OntologyEntry>()))
            )
          }),

        /**
         * Check if registry is available
         *
         * @returns true if OntologyRegistryService is configured and available
         */
        hasRegistry: Effect.succeed(Option.isSome(registryOpt)),

        /**
         * Generate a deterministic OntologyVersion from ontology ID and IRI
         *
         * For registry-based ontologies without content-addressed storage,
         * derives the version hash from the ontology IRI for reproducibility.
         *
         * @param ontologyId - Ontology identifier (e.g., "seattle")
         * @param ontologyIri - Full IRI of the ontology
         * @returns OntologyVersion in format "namespace/name@hash"
         *
         * @example
         * ```typescript
         * const version = OntologyService.generateVersion(
         *   "seattle",
         *   "http://effect-ontology.dev/seattle"
         * )
         * // Returns: "seattle/seattle@a1b2c3d4e5f67890"
         * ```
         */
        generateVersion: (ontologyId: string, ontologyIri: string): OntologyVersion => {
          const hash = createHash("sha256").update(ontologyIri).digest("hex").slice(0, 16)
          return `${ontologyId}/${ontologyId}@${hash}` as OntologyVersion
        },

        /**
         * Search for classes in a specific ontology using hybrid approach
         *
         * Loads ontology from URI, then performs hybrid search (semantic + BM25).
         * For multi-ontology deployments where each request specifies its own ontology.
         *
         * @param uri - Ontology URI (gs:// or storage-relative path)
         * @param query - Search query string
         * @param limit - Maximum number of results (default: 100)
         * @returns Chunk of ClassDefinition objects matching the query
         *
         * @example
         * ```typescript
         * const classes = yield* OntologyService.searchClassesHybridFromUri(
         *   "gs://bucket/seattle/ontology.ttl",
         *   "mayor city official",
         *   50
         * )
         * ```
         */
        searchClassesHybridFromUri: (uri: string, query: string, limit: number = 100) =>
          Effect.gen(function*() {
            const { classes, hierarchy, properties, propertyHierarchy } = yield* loadOntologyFromUri(uri)
            const ontology = OntologyContext.make({
              classes: Chunk.toReadonlyArray(classes),
              hierarchy,
              propertyHierarchy,
              properties: Chunk.toReadonlyArray(properties)
            })

            // Create indexes for this specific ontology
            const [bm25Index, semanticIndex] = yield* Effect.all([
              nlp.createOntologyIndex(ontology),
              nlp.createOntologySemanticIndex(ontology).pipe(
                Effect.catch((error) =>
                  Effect.gen(function*() {
                    yield* Effect.logWarning("Failed to create semantic index, using BM25 only", {
                      uri,
                      error: String(error)
                    })
                    return null
                  })
                )
              )
            ], { concurrency: 2 })

            const searchLimit = Math.ceil(limit * 0.7)

            // Run searches in parallel
            const [semanticResults, bm25Results] = yield* Effect.all([
              // Semantic search (if index available)
              semanticIndex
                ? Effect.gen(function*() {
                  const results = yield* nlp.searchOntologySemanticIndex(
                    semanticIndex,
                    query,
                    searchLimit
                  )
                  const classesMap = new Map<string, ClassDefinition>()
                  for (const result of results) {
                    if (result.class) {
                      classesMap.set(result.class.id, result.class)
                    }
                    if (result.property) {
                      for (const domainIri of result.property.domain) {
                        const domainClass = ontology.classes.find((c) => c.id === domainIri)
                        if (domainClass) {
                          classesMap.set(domainClass.id, domainClass)
                        }
                      }
                    }
                  }
                  return Chunk.fromIterable(classesMap.values())
                }).pipe(
                  Effect.catch(() => Effect.succeed(Chunk.empty<ClassDefinition>()))
                )
                : Effect.succeed(Chunk.empty<ClassDefinition>()),
              // BM25 search
              Effect.gen(function*() {
                const results = yield* nlp.searchOntologyIndex(bm25Index, query, searchLimit)
                const classesMap = new Map<string, ClassDefinition>()
                for (const result of results) {
                  if (result.class) {
                    classesMap.set(result.class.id, result.class)
                  }
                  if (result.property) {
                    for (const domainIri of result.property.domain) {
                      const domainClass = ontology.classes.find((c) => c.id === domainIri)
                      if (domainClass) {
                        classesMap.set(domainClass.id, domainClass)
                      }
                    }
                  }
                }
                return Chunk.fromIterable(classesMap.values())
              })
            ], { concurrency: 2 })

            // Fuse results using RRF
            const semanticArray = Chunk.toReadonlyArray(semanticResults)
            const bm25Array = Chunk.toReadonlyArray(bm25Results)
            const fused = rrfFusion([semanticArray, bm25Array])

            // Include remaining classes if sparse results
            const fusedIds = new Set(fused.map((r) => r.id))
            const remaining: Array<ClassDefinition> = []
            if (fused.length < limit && ontology.classes.length <= limit) {
              for (const cls of ontology.classes) {
                if (!fusedIds.has(cls.id)) remaining.push(cls)
              }
            }

            yield* Effect.logDebug("URI-specific hybrid search complete", {
              uri,
              query,
              semanticCount: semanticArray.length,
              bm25Count: bm25Array.length,
              fusedCount: fused.length,
              ontologySize: ontology.classes.length
            })

            const results = [
              ...fused.map((r) => {
                const { rrfScore: _, ...cls } = r
                return cls as ClassDefinition
              }),
              ...remaining
            ]
            return Chunk.fromIterable(results.slice(0, limit))
          }),

        /**
         * Get properties for given class IRIs from a specific ontology
         *
         * @param uri - Ontology URI (gs:// or storage-relative path)
         * @param classIris - Array of class IRIs to get properties for
         * @returns Chunk of PropertyDefinition objects
         */
        getPropertiesForFromUri: (uri: string, classIris: ReadonlyArray<string>) =>
          Effect.gen(function*() {
            const { classes, hierarchy, properties, propertyHierarchy } = yield* loadOntologyFromUri(uri)
            const ontology = OntologyContext.make({
              classes: Chunk.toReadonlyArray(classes),
              hierarchy,
              propertyHierarchy,
              properties: Chunk.toReadonlyArray(properties)
            })
            const props: Array<PropertyDefinition> = []
            for (const classIri of classIris) {
              const classProps = ontology.getPropertiesForClass(classIri)
              for (const prop of classProps) {
                props.push(prop)
              }
            }
            const uniqueProps = new Map<string, PropertyDefinition>()
            for (const prop of props) {
              uniqueProps.set(prop.id, prop)
            }
            return Chunk.fromIterable(uniqueProps.values())
          }),

        /**
         * Search for classes in a specific ontology using hybrid approach with pre-computed embeddings
         *
         * Loads ontology from URI, uses pre-computed embeddings for semantic search.
         * Combines with BM25 search for improved recall.
         *
         * @param uri - Ontology URI (gs:// or storage-relative path)
         * @param query - Search query string
         * @param embeddings - Pre-computed ontology embeddings
         * @param limit - Maximum number of results (default: 100)
         * @returns Chunk of ClassDefinition objects matching the query
         */
        searchClassesHybridFromUriWithEmbeddings: (
          uri: string,
          query: string,
          embeddings: OntologyEmbeddings,
          limit: number = 100
        ) =>
          Effect.gen(function*() {
            const { classes, hierarchy, properties, propertyHierarchy } = yield* loadOntologyFromUri(uri)
            const ontology = OntologyContext.make({
              classes: Chunk.toReadonlyArray(classes),
              hierarchy,
              propertyHierarchy,
              properties: Chunk.toReadonlyArray(properties)
            })

            const searchLimit = Math.ceil(limit * 0.7)

            // Create semantic index from pre-computed embeddings
            const semanticIndex = yield* nlp.createOntologySemanticIndexFromPrecomputed(
              ontology,
              embeddings
            ).pipe(
              Effect.catch((error) =>
                Effect.gen(function*() {
                  yield* Effect.logWarning("Failed to create semantic index from embeddings, using BM25 only", {
                    uri,
                    error: String(error)
                  })
                  return null
                })
              )
            )

            // Create BM25 index for this ontology
            const bm25Index = yield* nlp.createOntologyIndex(ontology)

            // Run searches in parallel
            const [semanticResults, bm25Results] = yield* Effect.all([
              semanticIndex
                ? Effect.gen(function*() {
                  const results = yield* nlp.searchOntologySemanticIndex(
                    semanticIndex,
                    query,
                    searchLimit
                  )
                  const classesMap = new Map<string, ClassDefinition>()
                  for (const result of results) {
                    if (result.class) {
                      classesMap.set(result.class.id, result.class)
                    }
                    if (result.property) {
                      for (const domainIri of result.property.domain) {
                        const domainClass = ontology.classes.find((c) => c.id === domainIri)
                        if (domainClass) {
                          classesMap.set(domainClass.id, domainClass)
                        }
                      }
                    }
                  }
                  return Chunk.fromIterable(classesMap.values())
                }).pipe(
                  Effect.catch(() => Effect.succeed(Chunk.empty<ClassDefinition>()))
                )
                : Effect.succeed(Chunk.empty<ClassDefinition>()),
              Effect.gen(function*() {
                const results = yield* nlp.searchOntologyIndex(bm25Index, query, searchLimit)
                const classesMap = new Map<string, ClassDefinition>()
                for (const result of results) {
                  if (result.class) {
                    classesMap.set(result.class.id, result.class)
                  }
                  if (result.property) {
                    for (const domainIri of result.property.domain) {
                      const domainClass = ontology.classes.find((c) => c.id === domainIri)
                      if (domainClass) {
                        classesMap.set(domainClass.id, domainClass)
                      }
                    }
                  }
                }
                return Chunk.fromIterable(classesMap.values())
              })
            ], { concurrency: 2 })

            // Fuse results using RRF
            const semanticArray = Chunk.toReadonlyArray(semanticResults)
            const bm25Array = Chunk.toReadonlyArray(bm25Results)
            const fused = rrfFusion([semanticArray, bm25Array])

            // Include remaining classes if sparse results
            const fusedIds = new Set(fused.map((r) => r.id))
            const remaining: Array<ClassDefinition> = []
            if (fused.length < limit && ontology.classes.length <= limit) {
              for (const cls of ontology.classes) {
                if (!fusedIds.has(cls.id)) remaining.push(cls)
              }
            }

            yield* Effect.logDebug("URI-specific hybrid search with embeddings complete", {
              uri,
              query,
              semanticCount: semanticArray.length,
              bm25Count: bm25Array.length,
              fusedCount: fused.length,
              ontologySize: ontology.classes.length
            })

            const results = [
              ...fused.map((r) => {
                const { rrfScore: _, ...cls } = r
                return cls as ClassDefinition
              }),
              ...remaining
            ]
            return Chunk.fromIterable(results.slice(0, limit))
          }),

        /**
         * Get the ontology context
         *
         * @returns OntologyContext object
         */
        ontology: Effect.gen(function*() {
          const { classes, hierarchy, properties, propertyHierarchy } = yield* getOntology
          return OntologyContext.make({
            classes: Chunk.toReadonlyArray(classes),
            hierarchy,
            propertyHierarchy,
            properties: Chunk.toReadonlyArray(properties)
          })
        }),

        /**
         * Search for classes matching the query using BM25
         *
         * Creates a BM25 index from the ontology and searches for matching classes.
         * Returns top-k classes ranked by relevance score.
         *
         * @param query - Search query string
         * @param limit - Maximum number of results (default: 10)
         * @returns Chunk of ClassDefinition objects matching the query
         *
         * @example
         * ```typescript
         * const classes = yield* OntologyService.searchClasses("person entity", 5)
         * ```
         */
        searchClasses: (query: string, limit: number = 10) =>
          Effect.gen(function*() {
            const { classes, hierarchy, properties, propertyHierarchy } = yield* getOntology
            const ontology = OntologyContext.make({
              classes: Chunk.toReadonlyArray(classes),
              hierarchy,
              propertyHierarchy,
              properties: Chunk.toReadonlyArray(properties)
            })
            const index = yield* getBm25Index
            const results = yield* nlp.searchOntologyIndex(index, query, limit)

            // Map to Classes, handling Property -> Domain resolution
            const validClasses = new Map<string, ClassDefinition>()

            for (const result of results) {
              // A. Direct Class Match
              if (result.class) {
                validClasses.set(result.class.id, result.class)
              }

              // B. Property Match -> Resolve Domain Classes
              if (result.property) {
                for (const domainIri of result.property.domain) {
                  // Find class by matching full IRI
                  const domainClass = ontology.classes.find(
                    (c) => c.id === domainIri
                  )
                  if (domainClass) {
                    validClasses.set(domainClass.id, domainClass)
                  }
                }
              }
            }

            return Chunk.fromIterable(validClasses.values())
          }),

        /**
         * Search for properties matching the query using BM25
         *
         * Creates a BM25 index from the ontology and searches for matching properties.
         * Returns top-k properties ranked by relevance score.
         *
         * @param query - Search query string
         * @param limit - Maximum number of results (default: 10)
         * @returns Chunk of PropertyDefinition objects matching the query
         *
         * @example
         * ```typescript
         * const properties = yield* OntologyService.searchProperties("name field", 5)
         * ```
         */
        searchProperties: (query: string, limit: number = 10) =>
          Effect.gen(function*() {
            const index = yield* getBm25Index
            const results = yield* nlp.searchOntologyIndex(index, query, limit)

            // Filter to properties only and return as Chunk
            return Chunk.fromIterable(
              results
                .filter((r) => r.property !== undefined)
                .map((r) => r.property!)
            )
          }),

        /**
         * Get properties for given class IRIs
         *
         * Returns all properties whose domain includes any of the provided class IRIs.
         *
         * @param classIris - Array of class IRIs to get properties for
         * @returns Chunk of PropertyDefinition objects
         *
         * @example
         * ```typescript
         * const properties = yield* OntologyService.getPropertiesFor(["http://schema.org/Person"])
         * ```
         */
        getPropertiesFor: (classIris: ReadonlyArray<string>) =>
          Effect.gen(function*() {
            const { classes, hierarchy, properties, propertyHierarchy } = yield* getOntology
            const ontology = OntologyContext.make({
              classes: Chunk.toReadonlyArray(classes),
              hierarchy,
              propertyHierarchy,
              properties: Chunk.toReadonlyArray(properties)
            })
            const props: Array<PropertyDefinition> = []
            for (const classIri of classIris) {
              const classProps = ontology.getPropertiesForClass(classIri)
              for (const prop of classProps) {
                props.push(prop)
              }
            }
            // Remove duplicates (same property might be in multiple classes)
            const uniqueProps = new Map<string, PropertyDefinition>()
            for (const prop of props) {
              uniqueProps.set(prop.id, prop)
            }
            return Chunk.fromIterable(uniqueProps.values())
          }),

        /**
         * Search for classes matching the query using semantic embeddings
         *
         * Creates a semantic index from the ontology and searches for matching classes
         * using cosine similarity of word embeddings. More robust to paraphrasing than BM25.
         * Returns top-k classes ranked by semantic similarity score.
         *
         * @param query - Search query string
         * @param limit - Maximum number of results (default: 10)
         * @returns Chunk of ClassDefinition objects matching the query
         *
         * @example
         * ```typescript
         * const classes = yield* OntologyService.searchClassesSemantic("athlete person", 5)
         * ```
         */
        searchClassesSemantic: (query: string, limit: number = 10) =>
          Effect.gen(function*() {
            const { classes, hierarchy, properties, propertyHierarchy } = yield* getOntology
            const ontology = OntologyContext.make({
              classes: Chunk.toReadonlyArray(classes),
              hierarchy,
              propertyHierarchy,
              properties: Chunk.toReadonlyArray(properties)
            })

            const index = yield* getSemanticIndex
            const results = yield* nlp.searchOntologySemanticIndex(
              index,
              query,
              limit
            )

            // Map to Classes, handling Property -> Domain resolution
            const validClasses = new Map<string, ClassDefinition>()

            for (const result of results) {
              // A. Direct Class Match
              if (result.class) {
                validClasses.set(result.class.id, result.class)
              }

              // B. Property Match -> Resolve Domain Classes
              if (result.property) {
                for (const domainIri of result.property.domain) {
                  // Find class by matching full IRI
                  const domainClass = ontology.classes.find(
                    (c) => c.id === domainIri
                  )
                  if (domainClass) {
                    validClasses.set(domainClass.id, domainClass)
                  }
                }
              }
            }

            return Chunk.fromIterable(validClasses.values())
          }),

        /**
         * Search for properties matching the query using semantic embeddings
         *
         * Creates a semantic index from the ontology and searches for matching properties
         * using cosine similarity of word embeddings. More robust to paraphrasing than BM25.
         * Returns top-k properties ranked by semantic similarity score.
         *
         * @param query - Search query string
         * @param limit - Maximum number of results (default: 10)
         * @returns Chunk of PropertyDefinition objects matching the query
         *
         * @example
         * ```typescript
         * const properties = yield* OntologyService.searchPropertiesSemantic("name identifier", 5)
         * ```
         */
        searchPropertiesSemantic: (query: string, limit: number = 10) =>
          Effect.gen(function*() {
            const index = yield* getSemanticIndex
            const results = yield* nlp.searchOntologySemanticIndex(
              index,
              query,
              limit
            )

            // Filter to properties only and return as Chunk
            return Chunk.fromIterable(
              results
                .filter((r) => r.property !== undefined)
                .map((r) => r.property!)
            )
          }),

        /**
         * Search for classes using hybrid approach (semantic + BM25)
         *
         * Combines semantic search (using embeddings) with BM25 text search for
         * improved recall. Semantic search failures are gracefully handled by
         * returning empty results. For small ontologies, includes all classes
         * up to the limit.
         *
         * @param query - Search query string
         * @param limit - Maximum number of results (default: 100)
         * @returns Chunk of ClassDefinition objects matching the query
         *
         * @example
         * ```typescript
         * const classes = yield* OntologyService.searchClassesHybrid("player scored goal", 100)
         * ```
         */
        searchClassesHybrid: (query: string, limit: number = 100) =>
          Effect.gen(function*() {
            const { classes, hierarchy, properties, propertyHierarchy } = yield* getOntology
            const ontology = OntologyContext.make({
              classes: Chunk.toReadonlyArray(classes),
              hierarchy,
              propertyHierarchy,
              properties: Chunk.toReadonlyArray(properties)
            })

            const searchLimit = Math.ceil(limit * 0.7)

            // Run semantic and BM25 searches in parallel
            // Semantic search gracefully returns empty on failure
            const [semanticResults, bm25Results] = yield* Effect.all([
              Effect.gen(function*() {
                const semanticIndex = yield* getSemanticIndex
                const results = yield* nlp.searchOntologySemanticIndex(
                  semanticIndex,
                  query,
                  searchLimit
                )
                // Map to ClassDefinitions
                const classesMap = new Map<string, ClassDefinition>()
                for (const result of results) {
                  if (result.class) {
                    classesMap.set(result.class.id, result.class)
                  }
                  if (result.property) {
                    for (const domainIri of result.property.domain) {
                      const domainClass = ontology.classes.find(
                        (c) => c.id === domainIri
                      )
                      if (domainClass) {
                        classesMap.set(domainClass.id, domainClass)
                      }
                    }
                  }
                }
                return Chunk.fromIterable(classesMap.values())
              }).pipe(
                Effect.catch((error) =>
                  Effect.gen(function*() {
                    yield* Effect.logWarning("Semantic search failed, using BM25 fallback", {
                      error: String(error),
                      query
                    })
                    return Chunk.empty<ClassDefinition>()
                  })
                )
              ),
              // BM25 search - more reliable, uses local index
              Effect.gen(function*() {
                const bm25Index = yield* getBm25Index
                const results = yield* nlp.searchOntologyIndex(bm25Index, query, searchLimit)
                const classesMap = new Map<string, ClassDefinition>()
                for (const result of results) {
                  if (result.class) {
                    classesMap.set(result.class.id, result.class)
                  }
                  if (result.property) {
                    for (const domainIri of result.property.domain) {
                      const domainClass = ontology.classes.find(
                        (c) => c.id === domainIri
                      )
                      if (domainClass) {
                        classesMap.set(domainClass.id, domainClass)
                      }
                    }
                  }
                }
                return Chunk.fromIterable(classesMap.values())
              })
            ], { concurrency: 2 })

            // Fuse results using Reciprocal Rank Fusion (RRF)
            // RRF properly combines ranking signals from both search methods
            const semanticArray = Chunk.toReadonlyArray(semanticResults)
            const bm25Array = Chunk.toReadonlyArray(bm25Results)
            const fused = rrfFusion([semanticArray, bm25Array])

            // If results are sparse, include remaining classes (sorted by RRF score = 0)
            // This ensures small ontologies get full coverage
            const fusedIds = new Set(fused.map((r) => r.id))
            const remaining: Array<ClassDefinition> = []
            if (fused.length < limit && ontology.classes.length <= limit) {
              for (const cls of ontology.classes) {
                if (!fusedIds.has(cls.id)) remaining.push(cls)
              }
            }

            yield* Effect.logDebug("Hybrid search complete", {
              query,
              semanticCount: semanticArray.length,
              bm25Count: bm25Array.length,
              fusedCount: fused.length,
              ontologySize: ontology.classes.length,
              limit
            })

            // Return fused results + remaining classes up to limit
            const results = [
              ...fused.map((r) => {
                const { rrfScore: _, ...cls } = r
                return cls as ClassDefinition
              }),
              ...remaining
            ]
            return Chunk.fromIterable(results.slice(0, limit))
          }),

        /**
         * Search for classes using hybrid approach with pre-computed embeddings
         *
         * Uses pre-loaded ontology embeddings instead of computing them on-the-fly.
         * Significantly faster for repeated workflows against the same ontology.
         *
         * @param query - Search query string
         * @param embeddings - Pre-computed ontology embeddings
         * @param limit - Maximum number of results (default: 100)
         * @returns Chunk of ClassDefinition objects matching the query
         *
         * @example
         * ```typescript
         * const embeddings = yield* loadOntologyEmbeddings(embeddingsUri)
         * const classes = yield* OntologyService.searchClassesHybridWithEmbeddings(
         *   "player scored goal",
         *   embeddings,
         *   100
         * )
         * ```
         */
        searchClassesHybridWithEmbeddings: (
          query: string,
          embeddings: OntologyEmbeddings,
          limit: number = 100
        ) =>
          Effect.gen(function*() {
            const { classes, hierarchy, properties, propertyHierarchy } = yield* getOntology
            const ontology = OntologyContext.make({
              classes: Chunk.toReadonlyArray(classes),
              hierarchy,
              propertyHierarchy,
              properties: Chunk.toReadonlyArray(properties)
            })

            const searchLimit = Math.ceil(limit * 0.7)

            // Create semantic index from pre-computed embeddings
            const semanticIndex = yield* nlp.createOntologySemanticIndexFromPrecomputed(
              ontology,
              embeddings
            )

            // Run semantic and BM25 searches in parallel
            const [semanticResults, bm25Results] = yield* Effect.all([
              Effect.gen(function*() {
                const results = yield* nlp.searchOntologySemanticIndex(
                  semanticIndex,
                  query,
                  searchLimit
                )
                // Map to ClassDefinitions
                const classesMap = new Map<string, ClassDefinition>()
                for (const result of results) {
                  if (result.class) {
                    classesMap.set(result.class.id, result.class)
                  }
                  if (result.property) {
                    for (const domainIri of result.property.domain) {
                      const domainClass = ontology.classes.find(
                        (c) => c.id === domainIri
                      )
                      if (domainClass) {
                        classesMap.set(domainClass.id, domainClass)
                      }
                    }
                  }
                }
                return Chunk.fromIterable(classesMap.values())
              }).pipe(
                Effect.catch((error) =>
                  Effect.gen(function*() {
                    yield* Effect.logWarning("Semantic search with embeddings failed, using BM25 fallback", {
                      error: String(error),
                      query
                    })
                    return Chunk.empty<ClassDefinition>()
                  })
                )
              ),
              // BM25 search - more reliable, uses local index
              Effect.gen(function*() {
                const bm25Index = yield* getBm25Index
                const results = yield* nlp.searchOntologyIndex(bm25Index, query, searchLimit)
                const classesMap = new Map<string, ClassDefinition>()
                for (const result of results) {
                  if (result.class) {
                    classesMap.set(result.class.id, result.class)
                  }
                  if (result.property) {
                    for (const domainIri of result.property.domain) {
                      const domainClass = ontology.classes.find(
                        (c) => c.id === domainIri
                      )
                      if (domainClass) {
                        classesMap.set(domainClass.id, domainClass)
                      }
                    }
                  }
                }
                return Chunk.fromIterable(classesMap.values())
              })
            ], { concurrency: 2 })

            // Fuse results using Reciprocal Rank Fusion (RRF)
            const semanticArray = Chunk.toReadonlyArray(semanticResults)
            const bm25Array = Chunk.toReadonlyArray(bm25Results)
            const fused = rrfFusion([semanticArray, bm25Array])

            // If results are sparse, include remaining classes
            const fusedIds = new Set(fused.map((r) => r.id))
            const remaining: Array<ClassDefinition> = []
            if (fused.length < limit && ontology.classes.length <= limit) {
              for (const cls of ontology.classes) {
                if (!fusedIds.has(cls.id)) remaining.push(cls)
              }
            }

            yield* Effect.logDebug("Hybrid search with pre-computed embeddings complete", {
              query,
              semanticCount: semanticArray.length,
              bm25Count: bm25Array.length,
              fusedCount: fused.length,
              ontologySize: ontology.classes.length,
              limit
            })

            // Return fused results + remaining classes up to limit
            const results = [
              ...fused.map((r) => {
                const { rrfScore: _, ...cls } = r
                return cls as ClassDefinition
              }),
              ...remaining
            ]
            return Chunk.fromIterable(results.slice(0, limit))
          }),

        /**
         * Get class hierarchy checker function for OWL subclass reasoning
         *
         * Returns a function that checks if a class is a subclass of another
         * using the ontology's class hierarchy. Useful for domain/range validation
         * that respects OWL subclass relationships.
         *
         * @returns Function (childIri, parentIri) => boolean
         *
         * @example
         * ```typescript
         * const isSubClassOf = yield* OntologyService.getClassHierarchyChecker()
         * // Check if core#Person is a subclass of core#TrackedEntity
         * isSubClassOf("http://effect-ontology.dev/core#Person", "http://effect-ontology.dev/core#TrackedEntity")
         * ```
         */
        getClassHierarchyChecker: () =>
          Effect.gen(function*() {
            const { classes, hierarchy, properties, propertyHierarchy } = yield* getOntology
            const ontology = OntologyContext.make({
              classes: Chunk.toReadonlyArray(classes),
              hierarchy,
              propertyHierarchy,
              properties: Chunk.toReadonlyArray(properties)
            })
            return (childIri: string, parentIri: string): boolean =>
              ontology.isSubClassOf(childIri, parentIri)
          })
      }
    }),
  }
) {
    static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([
              RdfBuilder.Default, // Includes ConfigServiceDefault
              NlpService.Default
              // StorageService provided by parent scope (runtime-selected storage type)
            ]));
}
