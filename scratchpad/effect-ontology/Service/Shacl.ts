/**
 * Service: SHACL Validation
 *
 * Provides SHACL validation capabilities using shacl-engine with Effect
 * integration. Handles shape loading, validation execution, and report mapping.
 *
 * @since 2.0.0
 * @module Service/Shacl
 */

import { Context, DateTime, Duration, Effect, HashMap, Layer, MutableHashMap, Option, Order, Ref, Schema } from "effect"
import * as A from "effect/Array"
import * as Str from "effect/String"
import * as N3 from "n3"
import { Validator as ShaclValidator } from "shacl-engine"
// @ts-expect-error - shacl-engine/sparql.js has no type declarations
import { validations as sparqlValidations } from "shacl-engine/sparql.ts"
import {
  ShaclValidationError,
  ShapesLoadError,
  ValidationPolicyError,
  ValidationReportError
} from "../Domain/Error/Shacl.ts"
import { ShaclValidationReport, ShaclViolation, ValidationPolicy } from "../Domain/Schema/Shacl.ts"
import { sha256Sync } from "../Utils/Hash.ts"
import type { RdfStore } from "./Rdf.ts"
import { RdfBuilder } from "./Rdf.ts"
import { StorageService } from "./Storage.ts"
const $I = $ScratchpadId.create("effect-ontology/Service/Shacl");
import { $ScratchpadId } from "@beep/identity";
import * as O from "effect/Option";
import { NonNegativeInt } from "@beep/schema/Int";

// Re-export types for backward compatibility
export { ShaclValidationReport, ShaclViolation, ValidationPolicy }

const mapSeverity = (severity: { value?: string } | undefined): "Violation" | "Warning" | "Info" => {
  if (!severity?.value) return "Info"
  if (Str.endsWith("Violation")(severity.value)) return "Violation"
  if (Str.endsWith("Warning")(severity.value)) return "Warning"
  return "Info"
}

/**
 * Extract a string message from SHACL validation result message.
 * Messages can be:
 * - A string directly
 * - An array of strings
 * - An array of RDF literal objects with .value property
 * - An RDF literal object with .value property
 */
const extractMessage = (message: unknown): string => {
  if (!message) return "Constraint violation"

  // Handle string directly
  if (typeof message === "string") return message

  // Handle array
  if (A.isArray(message)) {
    const firstMsg = message[0]
    if (!firstMsg) return "Constraint violation"
    // Array element could be string or object with .value
    if (typeof firstMsg === "string") return firstMsg
    if (typeof firstMsg === "object" && firstMsg !== null && "value" in firstMsg) {
      return String((firstMsg as { value: unknown }).value)
    }
    return String(firstMsg)
  }

  // Handle object with .value property (RDF literal)
  if (typeof message === "object" && message !== null && "value" in message) {
    return String((message as { value: unknown }).value)
  }

  // Fallback
  return String(message)
}

const stripGsPrefix = (uri: string): string =>
  Str.startsWith("gs://")(uri) ? Str.replace(/^gs:\/\/[^/]+\//, "")(uri) : uri

/**
 * Compute a hash key for an N3 store by serializing to N-Quads
 * N-Quads is a canonical format so identical graphs produce identical hashes
 */
const hashStore = (store: N3.Store): string => {
  const writer = new N3.Writer({ format: "N-Quads" })
  for (const quad of store) {
    writer.addQuad(quad)
  }
  let nquads = ""
  writer.end((_error, result) => {
    nquads = result
  })
  // Sort lines for canonical ordering (N-Quads lines are independent)
  const sortedNquads = A.join(A.sort(Str.split("\n")(nquads), Order.String), "\n")
  return sha256Sync(sortedNquads)
}

const decodeShaclViolation = Schema.decodeUnknownSync(ShaclViolation)

export interface ShaclServiceMethods {
  readonly validate: (
    dataStore: RdfStore["_store"],
    shapesStore: N3.Store
  ) => Effect.Effect<ShaclValidationReport, ShaclValidationError>

  readonly loadShapes: (shapesTurtle: string) => Effect.Effect<N3.Store, ShapesLoadError>

  readonly loadShapesFromUri: (shapesUri: string) => Effect.Effect<N3.Store, ShapesLoadError>

  readonly generateShapesFromOntology: (
    ontologyStore: RdfStore["_store"]
  ) => Effect.Effect<N3.Store, ValidationReportError>

  /**
   * Clear the shapes cache. Useful for testing or when ontology has changed.
   *
   * @since 2.0.0
   */
  readonly clearShapesCache: () => Effect.Effect<void>

  /**
   * Get cache statistics for monitoring
   *
   * @since 2.0.0
   */
  readonly getShapesCacheStats: () => Effect.Effect<{ size: number; keys: ReadonlyArray<string> }>

  /**
   * Validate with policy-based control over severity handling
   *
   * Performs SHACL validation and applies the given policy to determine
   * whether to fail based on violation/warning severity levels.
   *
   * @param dataStore - The RDF data graph to validate
   * @param shapesStore - The SHACL shapes graph
   * @param policy - Policy controlling which severities cause failure
   * @returns The validation report on success, or ValidationPolicyError if policy violated
   *
   * @since 2.0.0
   */
  readonly validateWithPolicy: (
    dataStore: RdfStore["_store"],
    shapesStore: N3.Store,
    policy: ValidationPolicy
  ) => Effect.Effect<ShaclValidationReport, ShaclValidationError | ValidationPolicyError>
}

/**
 * Configuration for ShaclService.Test layer
 *
 * @since 2.0.0
 * @category Test
 */
export interface ShaclServiceTestConfig {
  /** Whether validation should report conformance (default: true) */
  readonly conforms?: boolean
  /** Mock violations to return (default: []) */
  readonly violations?: ReadonlyArray<ShaclViolation>
}

/**
 * Default test configuration - always conforms with no violations
 *
 * @since 2.0.0
 * @category Test
 */
export const defaultTestConfig: ShaclServiceTestConfig = {
  conforms: true,
  violations: []
}

export class ShaclService extends Context.Service<ShaclService, ShaclServiceMethods>()($I`ShaclService`) {
  /**
   * Test layer with configurable mock behavior
   *
   * Creates a test double that returns predictable results without
   * running actual SHACL validation. Useful for unit testing workflows
   * that depend on ShaclService.
   *
   * @param config - Optional configuration for mock behavior
   * @returns Layer providing mock ShaclService
   *
   * @example
   * ```typescript
   * // Default - always conforms
   * const layer = ShaclService.Test()
   *
   * // Custom - with violations
   * const layerWithViolations = ShaclService.Test({
   *   conforms: false,
   *   violations: [{
   *     focusNode: "http://example.org/entity1",
   *     message: "Missing required property",
   *     severity: "Violation"
   *   }]
   * })
   * ```
   *
   * @since 2.0.0
   * @category Layers
   */
  static readonly Test = (config: ShaclServiceTestConfig = defaultTestConfig): Layer.Layer<ShaclService> =>
    Layer.effect(
      ShaclService,
      Effect.gen(function*() {
        const conforms = config.conforms ?? true
        const violations = config.violations ?? []

        // Track shapes cache for getShapesCacheStats
        const shapesCache = yield* Ref.make(HashMap.empty<string, N3.Store>())

        const makeReport = (dataStore: N3.Store, shapesStore: N3.Store): Effect.Effect<ShaclValidationReport> =>
          Effect.gen(function*() {
            const now = yield* DateTime.now
            return ShaclValidationReport.make({
              conforms,
              violations,
              validatedAt: now,
              dataGraphTripleCount: NonNegativeInt.make(dataStore.size),
              shapesGraphTripleCount: NonNegativeInt.make(shapesStore.size),
              durationMs: Duration.zero
            })
          })

        return {
          validate: (dataStore, shapesStore) => makeReport(dataStore, shapesStore),

          loadShapes: (_shapesTurtle) => Effect.succeed(new N3.Store()),

          loadShapesFromUri: (_shapesUri) => Effect.succeed(new N3.Store()),

          generateShapesFromOntology: (ontologyStore) =>
            Effect.gen(function*() {
              // Cache the generated store
              const cacheKey = `test-${ontologyStore.size}`
              const store = new N3.Store()
              yield* Ref.update(shapesCache, (map) => {
                return HashMap.set(map, cacheKey, store)
              })
              return store
            }),

          clearShapesCache: () => Ref.set(shapesCache, HashMap.empty()),

          getShapesCacheStats: () =>
            Ref.get(shapesCache).pipe(
              Effect.map((cache) => ({
                size: HashMap.size(cache),
                keys: A.fromIterable(HashMap.keys(cache))
              }))
            ),

          validateWithPolicy: (dataStore, shapesStore, policy) =>
            Effect.gen(function*() {
              const report = yield* makeReport(dataStore, shapesStore)

              const violationCount = A.filter(report.violations, (violation) => violation.severity === "Violation").length
              const warningCount = A.filter(report.violations, (violation) => violation.severity === "Warning").length

              const failOnViolation = policy.failOnViolation ?? true
              const failOnWarning = policy.failOnWarning ?? false

              if (failOnViolation && violationCount > 0) {
                return yield* Effect.fail(
                  ValidationPolicyError.make({
                    message: `Validation policy failed: ${violationCount} violation(s) found`,
                    violationCount: NonNegativeInt.make(violationCount),
                    warningCount: NonNegativeInt.make(warningCount),
                    severity: "Violation"
                  })
                )
              }

              if (failOnWarning && warningCount > 0) {
                return yield* Effect.fail(
                  ValidationPolicyError.make({
                    message: `Validation policy failed: ${warningCount} warning(s) found`,
                    violationCount: NonNegativeInt.make(violationCount),
                    warningCount: NonNegativeInt.make(warningCount),
                    severity: "Warning"
                  })
                )
              }

              return report
            })
        }
      })
    )

  static readonly Default: Layer.Layer<ShaclService, never, RdfBuilder | StorageService> = Layer.effect(
    ShaclService,
    Effect.gen(function*() {
      const rdfBuilder = yield* RdfBuilder
      const storage = yield* StorageService

      // Cache for generated SHACL shapes, keyed by ontology content hash
      const shapesCache = yield* Ref.make(HashMap.empty<string, N3.Store>())

      const loadShapes = (shapesTurtle: string) =>
        rdfBuilder.parseTurtle(shapesTurtle).pipe(
          Effect.map((store) => store._store),
          Effect.mapError((cause) =>
            ShapesLoadError.make({
              message: `Failed to parse SHACL shapes: ${cause}`,
              cause: O.some(cause)
            })
          )
        )

      return {
        validate: (dataStore, shapesStore) =>
          Effect.gen(function*() {
            const start = yield* DateTime.now

            const validator = yield* Effect.try({
              try: () =>
                new ShaclValidator(shapesStore, {
                  factory: N3.DataFactory,
                  debug: false,
                  coverage: false,
                  // Enable SPARQL-based constraints (sh:sparql)
                  validations: sparqlValidations
                }),
              catch: (cause) =>
                ShaclValidationError.make({
                  message: `Failed to create SHACL validator: ${cause}`,
                  cause: O.some(cause)
                })
            })

            const report = yield* Effect.tryPromise({
              try: async () => validator.validate({ dataset: dataStore }),
              catch: (cause) =>
                ShaclValidationError.make({
                  message: `SHACL validation failed: ${cause}`,
                  cause: O.some(cause)
                })
            })

            const end = yield* DateTime.now

            return ShaclValidationReport.fromUnknown({
              conforms: report.conforms,
              violations: A.map(report.results ?? [], (result: any) => ({
                focusNode: result.focusNode?.value ?? "unknown",
                path: result.path?.value,
                value: result.value?.value,
                message: extractMessage(result.message),
                severity: mapSeverity(result.severity),
                sourceShape: result.sourceShape?.value
              })) ?? [],
              validatedAt: start,
              dataGraphTripleCount: dataStore.size,
              shapesGraphTripleCount: shapesStore.size,
              durationMs: Duration.toMillis(DateTime.distance(start, end))
            })
          }),

        loadShapes,

        loadShapesFromUri: (shapesUri: string) =>
          storage.get(stripGsPrefix(shapesUri)).pipe(
            Effect.flatMap((maybeContent) =>
              Option.match(O.fromNullishOr(maybeContent), {
                onNone: () =>
                  Effect.fail(
                    ShapesLoadError.fromUnknown({
                      message: `Shapes not found at ${shapesUri}`,
                      shapesUri
                    })
                  ),
                onSome: loadShapes
              })
            ),
            Effect.mapError((cause) =>
              cause instanceof ShapesLoadError
                ? cause
                : ShapesLoadError.fromUnknown({
                  message: `Failed to load SHACL shapes from ${shapesUri}: ${cause}`,
                  shapesUri,
                  cause
                })
            )
          ),

        generateShapesFromOntology: (ontologyStore: RdfStore["_store"]) =>
          Effect.gen(function*() {
            // Check cache first
            const cacheKey = hashStore(ontologyStore)
            const cache = yield* Ref.get(shapesCache)

            const cached = HashMap.get(cache, cacheKey)
            if (Option.isSome(cached)) {
              // Return a clone of the cached store to prevent mutation
              const clonedStore = new N3.Store()
              for (const quad of cached.value) {
                clonedStore.addQuad(quad)
              }
              return clonedStore
            }

            // Generate shapes if not cached
            const generatedStore = yield* Effect.try({
              try: () => {
                const store = new N3.Store()
                const { namedNode } = N3.DataFactory

                // SHACL namespace
                const SH = {
                  NodeShape: namedNode("http://www.w3.org/ns/shacl#NodeShape"),
                  PropertyShape: namedNode("http://www.w3.org/ns/shacl#PropertyShape"),
                  targetClass: namedNode("http://www.w3.org/ns/shacl#targetClass"),
                  property: namedNode("http://www.w3.org/ns/shacl#property"),
                  path: namedNode("http://www.w3.org/ns/shacl#path"),
                  class: namedNode("http://www.w3.org/ns/shacl#class"),
                  datatype: namedNode("http://www.w3.org/ns/shacl#datatype"),
                  nodeKind: namedNode("http://www.w3.org/ns/shacl#nodeKind"),
                  IRI: namedNode("http://www.w3.org/ns/shacl#IRI"),
                  Literal: namedNode("http://www.w3.org/ns/shacl#Literal"),
                  minCount: namedNode("http://www.w3.org/ns/shacl#minCount"),
                  maxCount: namedNode("http://www.w3.org/ns/shacl#maxCount")
                }

                const RDF_TYPE = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")
                const OWL_CLASS = namedNode("http://www.w3.org/2002/07/owl#Class")
                const OWL_OBJECT_PROPERTY = namedNode("http://www.w3.org/2002/07/owl#ObjectProperty")
                const OWL_DATATYPE_PROPERTY = namedNode("http://www.w3.org/2002/07/owl#DatatypeProperty")
                const OWL_FUNCTIONAL_PROPERTY = namedNode("http://www.w3.org/2002/07/owl#FunctionalProperty")
                const OWL_RESTRICTION = namedNode("http://www.w3.org/2002/07/owl#Restriction")
                const OWL_ON_PROPERTY = namedNode("http://www.w3.org/2002/07/owl#onProperty")
                const OWL_MIN_CARDINALITY = namedNode("http://www.w3.org/2002/07/owl#minCardinality")
                const OWL_MAX_CARDINALITY = namedNode("http://www.w3.org/2002/07/owl#maxCardinality")
                const OWL_CARDINALITY = namedNode("http://www.w3.org/2002/07/owl#cardinality")
                const RDFS_DOMAIN = namedNode("http://www.w3.org/2000/01/rdf-schema#domain")
                const RDFS_RANGE = namedNode("http://www.w3.org/2000/01/rdf-schema#range")
                const RDFS_SUBCLASS_OF = namedNode("http://www.w3.org/2000/01/rdf-schema#subClassOf")
                const XSD_STRING = namedNode("http://www.w3.org/2001/XMLSchema#string")

                // Track property shapes by class+property key for cardinality constraints
                const propertyShapeMap = MutableHashMap.empty<string, N3.BlankNode>()
                const makeKey = (classIri: string, propIri: string) => `${classIri}|${propIri}`

                // Find all owl:Class instances
                const classes = ontologyStore.getQuads(null, RDF_TYPE, OWL_CLASS, null)

                for (const classQuad of classes) {
                  const classIri = classQuad.subject
                  const shapeIri = namedNode(`${classIri.value}Shape`)

                  // Add NodeShape
                  store.addQuad(shapeIri, RDF_TYPE, SH.NodeShape)
                  store.addQuad(shapeIri, SH.targetClass, classIri)

                  // Find ObjectProperties with this class as domain
                  const propsWithDomain = ontologyStore.getQuads(null, RDFS_DOMAIN, classIri, null)

                  for (const propQuad of propsWithDomain) {
                    const propIri = propQuad.subject

                    // Check if it's an ObjectProperty
                    const isObjectProp = ontologyStore.getQuads(propIri, RDF_TYPE, OWL_OBJECT_PROPERTY, null).length > 0
                    // Check if it's a DatatypeProperty
                    const isDatatypeProp =
                      ontologyStore.getQuads(propIri, RDF_TYPE, OWL_DATATYPE_PROPERTY, null).length > 0
                    // Check if it's a FunctionalProperty
                    const isFunctionalProp =
                      ontologyStore.getQuads(propIri, RDF_TYPE, OWL_FUNCTIONAL_PROPERTY, null).length > 0

                    if (isObjectProp) {
                      const propertyShape = N3.DataFactory.blankNode()
                      MutableHashMap.set(propertyShapeMap, makeKey(classIri.value, propIri.value), propertyShape)
                      store.addQuad(shapeIri, SH.property, propertyShape)
                      store.addQuad(propertyShape, SH.path, propIri)

                      // Get range
                      const rangeQuads = ontologyStore.getQuads(propIri, RDFS_RANGE, null, null)
                      if (rangeQuads.length > 0) {
                        store.addQuad(propertyShape, SH.class, rangeQuads[0].object)
                      }
                      store.addQuad(propertyShape, SH.nodeKind, SH.IRI)

                      // Add sh:maxCount 1 for FunctionalProperty
                      if (isFunctionalProp) {
                        store.addQuad(
                          propertyShape,
                          SH.maxCount,
                          N3.DataFactory.literal("1", namedNode("http://www.w3.org/2001/XMLSchema#integer"))
                        )
                      }
                    } else if (isDatatypeProp) {
                      // Handle DatatypeProperty - use sh:datatype constraint
                      const propertyShape = N3.DataFactory.blankNode()
                      MutableHashMap.set(propertyShapeMap, makeKey(classIri.value, propIri.value), propertyShape)
                      store.addQuad(shapeIri, SH.property, propertyShape)
                      store.addQuad(propertyShape, SH.path, propIri)

                      // Get range (XSD datatype)
                      const rangeQuads = ontologyStore.getQuads(propIri, RDFS_RANGE, null, null)
                      if (rangeQuads.length > 0) {
                        // Use sh:datatype for literal types
                        store.addQuad(propertyShape, SH.datatype, rangeQuads[0].object)
                      } else {
                        // Default to xsd:string if no range specified
                        store.addQuad(propertyShape, SH.datatype, XSD_STRING)
                      }
                      store.addQuad(propertyShape, SH.nodeKind, SH.Literal)

                      // Add sh:maxCount 1 for FunctionalProperty
                      if (isFunctionalProp) {
                        store.addQuad(
                          propertyShape,
                          SH.maxCount,
                          N3.DataFactory.literal("1", namedNode("http://www.w3.org/2001/XMLSchema#integer"))
                        )
                      }
                    }
                  }

                  // Process OWL restrictions on this class (rdfs:subClassOf owl:Restriction)
                  const subClassQuads = ontologyStore.getQuads(classIri, RDFS_SUBCLASS_OF, null, null)
                  for (const subClassQuad of subClassQuads) {
                    const restrictionNode = subClassQuad.object

                    // Check if it's an owl:Restriction
                    const isRestriction =
                      ontologyStore.getQuads(restrictionNode, RDF_TYPE, OWL_RESTRICTION, null).length > 0
                    if (!isRestriction) continue

                    // Get the property this restriction applies to
                    const onPropertyQuads = ontologyStore.getQuads(restrictionNode, OWL_ON_PROPERTY, null, null)
                    if (onPropertyQuads.length === 0) continue

                    const restrictedPropIri = onPropertyQuads[0].object
                    const key = makeKey(classIri.value, restrictedPropIri.value)

                    // Get or create property shape for this restriction
                    let propertyShape = MutableHashMap.get(propertyShapeMap, key)
                    if (Option.isNone(propertyShape)) {
                      // Create a new property shape if one doesn't exist
                      const created = N3.DataFactory.blankNode()
                      MutableHashMap.set(propertyShapeMap, key, created)
                      propertyShape = Option.some(created)
                      store.addQuad(shapeIri, SH.property, created)
                      store.addQuad(created, SH.path, restrictedPropIri)
                    }
                    const propertyShapeNode = Option.getOrThrow(propertyShape)

                    // Check for owl:minCardinality
                    const minCardQuads = ontologyStore.getQuads(restrictionNode, OWL_MIN_CARDINALITY, null, null)
                    if (minCardQuads.length > 0) {
                      const minValue = minCardQuads[0].object.value
                      store.addQuad(
                        propertyShapeNode,
                        SH.minCount,
                        N3.DataFactory.literal(minValue, namedNode("http://www.w3.org/2001/XMLSchema#integer"))
                      )
                    }

                    // Check for owl:maxCardinality
                    const maxCardQuads = ontologyStore.getQuads(restrictionNode, OWL_MAX_CARDINALITY, null, null)
                    if (maxCardQuads.length > 0) {
                      const maxValue = maxCardQuads[0].object.value
                      store.addQuad(
                        propertyShapeNode,
                        SH.maxCount,
                        N3.DataFactory.literal(maxValue, namedNode("http://www.w3.org/2001/XMLSchema#integer"))
                      )
                    }

                    // Check for owl:cardinality (exact cardinality = both min and max)
                    const exactCardQuads = ontologyStore.getQuads(restrictionNode, OWL_CARDINALITY, null, null)
                    if (exactCardQuads.length > 0) {
                      const exactValue = exactCardQuads[0].object.value
                      store.addQuad(
                        propertyShapeNode,
                        SH.minCount,
                        N3.DataFactory.literal(exactValue, namedNode("http://www.w3.org/2001/XMLSchema#integer"))
                      )
                      store.addQuad(
                        propertyShapeNode,
                        SH.maxCount,
                        N3.DataFactory.literal(exactValue, namedNode("http://www.w3.org/2001/XMLSchema#integer"))
                      )
                    }
                  }
                }

                return store
              },
              catch: (cause) =>
                ValidationReportError.make({
                  message: `Failed to generate shapes from ontology: ${cause}`,
                  cause: O.some(cause)
                })
            })

            // Store a clone in cache to prevent external mutations affecting cached data
            const cacheClone = new N3.Store()
            for (const quad of generatedStore) {
              cacheClone.addQuad(quad)
            }
            yield* Ref.update(shapesCache, (map) => HashMap.set(map, cacheKey, cacheClone))

            return generatedStore
          }),

        clearShapesCache: () => Ref.set(shapesCache, HashMap.empty()),

        getShapesCacheStats: () =>
          Ref.get(shapesCache).pipe(
            Effect.map((cache) => ({
              size: HashMap.size(cache),
              keys: A.fromIterable(HashMap.keys(cache))
            }))
          ),

        validateWithPolicy: (dataStore, shapesStore, policy) =>
                  Effect.gen(function*() {
                    // Run base validation
                    const validator = yield* Effect.try({
                      try: () =>
                        new ShaclValidator(shapesStore, {
                          factory: N3.DataFactory,
                          debug: false,
                          coverage: false,
                          // Enable SPARQL-based constraints (sh:sparql)
                          validations: sparqlValidations
                        }),
                      catch: (cause) =>
                        ShaclValidationError.make({
                          message: `Failed to create SHACL validator: ${cause}`,
                          cause: O.some(cause)
                        })
                    })

                    const start = yield* DateTime.now

                    const report = yield* Effect.tryPromise({
                      try: async () => validator.validate({ dataset: dataStore }),
                      catch: (cause) =>
                        ShaclValidationError.make({
                          message: `SHACL validation failed: ${cause}`,
                          cause: O.some(cause)
                        })
                    })

                    const end = yield* DateTime.now

                    // Map results
                    const violations = A.map(report.results ?? [], (result: any) => decodeShaclViolation({
                      focusNode: result.focusNode?.value ?? "unknown",
                      path: result.path?.value,
                      value: result.value?.value,
                      message: extractMessage(result.message),
                      severity: mapSeverity(result.severity),
                      sourceShape: result.sourceShape?.value
                    }))

                    const validationReport = ShaclValidationReport.fromUnknown({
                      conforms: report.conforms,
                      violations,
                      validatedAt: start,
                      dataGraphTripleCount: NonNegativeInt.make(dataStore.size),
                      shapesGraphTripleCount: NonNegativeInt.make(shapesStore.size),
                      durationMs: Duration.toMillis(DateTime.distance(start, end))
                    })

                    // Count by severity
                    const violationCount = A.filter(violations, (violation) => violation.severity === "Violation").length
                    const warningCount = A.filter(violations, (violation) => violation.severity === "Warning").length

                    // Apply policy (default: failOnViolation=true, failOnWarning=false)
                    const failOnViolation = policy.failOnViolation ?? true
                    const failOnWarning = policy.failOnWarning ?? false
                    const logOnly = policy.logOnly ?? false

                    // If logOnly is true, log issues but don't fail
                    if (logOnly) {
                      if (violationCount > 0 || warningCount > 0) {
                        yield* Effect.logWarning(
                          `SHACL validation: ${violationCount} violation(s), ${warningCount} warning(s) - continuing per logOnly policy`,
                          {
                            conforms: report.conforms,
                            violations: A.map(A.take(violations, 5), (violation) => ({
                                                                                      focusNode: violation.focusNode,
                                                                                      path: violation.path,
                                                                                      message: violation.message,
                                                                                      severity: violation.severity
                                                                                    }))
                          }
                        )
                      }
                      return validationReport
                    }

                    if (failOnViolation && violationCount > 0) {
                      return yield* Effect.fail(
                        ValidationPolicyError.make({
                          message: `Validation policy failed: ${violationCount} violation(s) found`,
                          violationCount: NonNegativeInt.make(violationCount),
                          warningCount: NonNegativeInt.make(warningCount),
                          severity: "Violation"
                        })
                      )
                    }

                    if (failOnWarning && warningCount > 0) {
                      return yield* Effect.fail(
                        ValidationPolicyError.make({
                          message: `Validation policy failed: ${warningCount} warning(s) found`,
                          violationCount: NonNegativeInt.make(violationCount),
                          warningCount: NonNegativeInt.make(warningCount),
                          severity: "Warning"
                        })
                      )
                    }

                    // Log info for warnings when not failing on them
                    if (warningCount > 0 && !failOnWarning) {
                      yield* Effect.logWarning(
                        `SHACL validation: ${warningCount} warning(s) detected but not failing per policy`
                      )
                    }

                    return validationReport
                  })
      }
    })
  )
}
