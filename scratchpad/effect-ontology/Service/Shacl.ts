/**
 * Service: SHACL Validation
 *
 * **Details**
 *
 * Workflow-specific SHACL shape loading, generation, policy, and execution
 * metadata. Validation execution is owned by the canonical semantic-web
 * contract and the `@beep/shacl` driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { IRI } from "@beep/rdf";
import { OWL_CLASS, OWL_DATATYPE_PROPERTY, OWL_NAMESPACE, OWL_OBJECT_PROPERTY } from "@beep/rdf/Vocab/Owl";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs";
import { XSD_INTEGER, XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { NonNegativeInt } from "@beep/schema/Int";
import type { ShaclValidationError, ShaclValidationViolation } from "@beep/semantic-web/services/shacl-validation";
import {
  ShaclValidationRequest,
  ShaclValidationResult,
  ShaclValidationService,
} from "@beep/semantic-web/services/shacl-validation";
import { ShaclValidationServiceLive } from "@beep/shacl";
import { Context, DateTime, Duration, Effect, HashMap, Layer, MutableHashMap, Order, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import * as N3 from "n3";
import { ShapesLoadError, ValidationPolicyError, ValidationReportError } from "../Domain/Error/Shacl.ts";
import { ShaclValidationReport, ValidationPolicy } from "../Domain/Schema/Shacl.ts";
import { sha256Sync } from "../Utils/Hash.ts";
import type { RdfStore } from "./Rdf.ts";
import { emptyRdfStore, RdfBuilder, rdfStoreSize, rdfStoreToDataset } from "./Rdf.ts";
import { StorageService } from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Shacl");
const SHACL_NAMESPACE = "https://www.w3.org/ns/shacl#";

export { ShaclValidationReport, ValidationPolicy };

const stripGsPrefix = (uri: string): string =>
  Str.startsWith("gs://")(uri) ? Str.replace(/^gs:\/\/[^/]+\//, "")(uri) : uri;

/**
 * Compute a hash key for an N3 store by serializing to N-Quads
 * N-Quads is a canonical format so identical graphs produce identical hashes
 */
const hashStore = (store: N3.Store): string => {
  const writer = new N3.Writer({ format: "N-Quads" });
  for (const quad of store) writer.addQuad(quad);
  let nquads = "";
  writer.end((_error, result) => {
    nquads = result;
  });
  return sha256Sync(A.join(A.sort(Str.split("\n")(nquads), Order.String), "\n"));
};

const serializeN3Store = (store: N3.Store): string => {
  const writer = new N3.Writer({ format: "Turtle" });
  writer.addQuads(A.fromIterable(store));
  let source = "";
  writer.end((_error, output) => {
    source = output;
  });
  return source;
};

/**
 * Describes the shacl workflow service methods data exposed by this module.
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ShaclWorkflowServiceMethods {
  readonly validateWithReport: (
    dataStore: RdfStore,
    shapesStore: RdfStore
  ) => Effect.Effect<ShaclValidationReport, ShaclValidationError>;

  readonly loadShapes: (shapesTurtle: string) => Effect.Effect<RdfStore, ShapesLoadError>;

  readonly loadShapesFromUri: (shapesUri: string) => Effect.Effect<RdfStore, ShapesLoadError>;

  readonly generateShapesFromOntology: (ontologyStore: RdfStore) => Effect.Effect<RdfStore, ValidationReportError>;

  /**
   * Clear the shapes cache. Useful for testing or when ontology has changed.
   *
   * @since 0.0.0
   */
  readonly clearShapesCache: Effect.Effect<void>;

  /**
   * Get cache statistics for monitoring
   *
   * @since 0.0.0
   */
  readonly getShapesCacheStats: Effect.Effect<{ size: number; keys: ReadonlyArray<string> }>;

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
   * @since 0.0.0
   */
  readonly validateWithPolicy: (
    dataStore: RdfStore,
    shapesStore: RdfStore,
    policy: ValidationPolicy
  ) => Effect.Effect<ShaclValidationReport, ShaclValidationError | ValidationPolicyError>;
}

/**
 * Configuration for ShaclWorkflowService.Test layer
 *
 *
 * **Example** (Use the ShaclWorkflowServiceTestConfig contract)
 *
 * ```ts
 * import type { ShaclWorkflowServiceTestConfig } from "@effect-ontology/Service/Shacl"
 *
 * const acceptsShaclWorkflowServiceTestConfig = (_value: ShaclWorkflowServiceTestConfig): void => undefined
 *
 * console.log(acceptsShaclWorkflowServiceTestConfig)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ShaclWorkflowServiceTestConfig {
  /** Whether validation should report conformance (default: true) */
  readonly conforms?: boolean;
  /** Mock violations to return (default: []) */
  readonly violations?: ReadonlyArray<ShaclValidationViolation>;
}

/**
 * Default test configuration - always conforms with no violations
 *
 * **Example** (Inspect default test config)
 *
 * ```ts
 * import { defaultTestConfig } from "@effect-ontology/Service/Shacl"
 *
 * console.log(defaultTestConfig)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const defaultTestConfig: ShaclWorkflowServiceTestConfig = {
  conforms: true,
  violations: [],
};

/**
 * Validates and represents shacl workflow service values at runtime.
 *
 * **Example** (Inspect shacl workflow service)
 *
 * ```ts
 * import { ShaclWorkflowService } from "@effect-ontology/Service/Shacl"
 *
 * console.log(ShaclWorkflowService)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class ShaclWorkflowService extends Context.Service<ShaclWorkflowService, ShaclWorkflowServiceMethods>()(
  $I`ShaclWorkflowService`
) {
  /**
   * Test layer with configurable mock behavior
   *
   * Creates a test double that returns predictable results without
   * running actual SHACL validation. Useful for unit testing workflows
   * that depend on ShaclWorkflowService.
   *
   * @param config - Optional configuration for mock behavior
   * @returns Layer providing mock ShaclWorkflowService
   *
   * **Example** (Use Test)
   * ```ts
   * // Default - always conforms
   * const layer = ShaclWorkflowService.Test()
   *
   * // Custom - with violations
   * const layerWithViolations = ShaclWorkflowService.Test({
   *   conforms: false,
   *   violations: [{
   *     focusNode: "https://example.org/entity1",
   *     message: "Missing required property",
   *     severity: "violation"
   *   }]
   * })
   * ```
   *
   * @since 0.0.0
   * @category layers
   */
  static readonly Test = (
    config: ShaclWorkflowServiceTestConfig = defaultTestConfig
  ): Layer.Layer<ShaclWorkflowService> =>
    Layer.effect(
      ShaclWorkflowService,
      Effect.gen(function* () {
        const conforms = config.conforms ?? true;
        const violations = config.violations ?? [];

        // Track shapes cache for getShapesCacheStats
        const shapesCache = yield* Ref.make(HashMap.empty<string, N3.Store>());

        const makeReport = Effect.fn("ShaclWorkflow.makeReport")(function* (
          dataStore: RdfStore,
          shapesStore: RdfStore
        ): Effect.fn.Return<ShaclValidationReport> {
          const now = yield* DateTime.now;
          return ShaclValidationReport.make({
            validation: ShaclValidationResult.make({ conforms, violations, truncated: false }),
            validatedAt: now,
            dataGraphTripleCount: NonNegativeInt.make(rdfStoreSize(dataStore)),
            shapesGraphTripleCount: NonNegativeInt.make(rdfStoreSize(shapesStore)),
            durationMs: Duration.zero,
          });
        });

        return {
          validateWithReport: Effect.fn("ShaclWorkflowService.validateWithReport")((dataStore, shapesStore) =>
            makeReport(dataStore, shapesStore)
          ),
          loadShapes: Effect.fn("ShaclService.loadShapes")((_shapesTurtle) => Effect.succeed(emptyRdfStore())),
          loadShapesFromUri: Effect.fn("ShaclService.loadShapesFromUri")((_shapesUri) =>
            Effect.succeed(emptyRdfStore())
          ),
          generateShapesFromOntology: Effect.fn("ShaclService.generateShapesFromOntology")(function* (ontologyStore) {
            const cacheKey = `test-${rdfStoreSize(ontologyStore)}`;
            const store = new N3.Store();
            yield* Ref.update(shapesCache, (map) => HashMap.set(map, cacheKey, store));
            return emptyRdfStore();
          }),
          clearShapesCache: Ref.set(shapesCache, HashMap.empty()),
          getShapesCacheStats: Ref.get(shapesCache).pipe(
            Effect.map((cache) => ({
              size: HashMap.size(cache),
              keys: A.fromIterable(HashMap.keys(cache)),
            }))
          ),
          validateWithPolicy: Effect.fn("ShaclService.validateWithPolicy")(function* (dataStore, shapesStore, policy) {
            const report = yield* makeReport(dataStore, shapesStore);
            const violationCount = A.filter(
              report.validation.violations,
              (violation) => violation.severity === "violation"
            ).length;
            const warningCount = A.filter(
              report.validation.violations,
              (violation) => violation.severity === "warning"
            ).length;
            const failOnViolation = policy.failOnViolation ?? true;
            const failOnWarning = policy.failOnWarning ?? false;
            if (failOnViolation && violationCount > 0) {
              return yield* ValidationPolicyError.make({
                message: `Validation policy failed: ${violationCount} violation(s) found`,
                violationCount: NonNegativeInt.make(violationCount),
                warningCount: NonNegativeInt.make(warningCount),
                severity: "violation",
              });
            }
            if (failOnWarning && warningCount > 0) {
              return yield* ValidationPolicyError.make({
                message: `Validation policy failed: ${warningCount} warning(s) found`,
                violationCount: NonNegativeInt.make(violationCount),
                warningCount: NonNegativeInt.make(warningCount),
                severity: "warning",
              });
            }
            return report;
          }),
        };
      })
    );

  static readonly Default: Layer.Layer<ShaclWorkflowService, never, RdfBuilder | StorageService> = Layer.effect(
    ShaclWorkflowService,
    Effect.gen(function* () {
      const rdfBuilder = yield* RdfBuilder;
      const storage = yield* StorageService;
      const validationService = yield* ShaclValidationService;

      // Cache for generated SHACL shapes, keyed by ontology content hash
      const shapesCache = yield* Ref.make(HashMap.empty<string, N3.Store>());

      const loadShapes = (shapesTurtle: string) =>
        rdfBuilder.parseTurtle(shapesTurtle).pipe(
          Effect.mapError((cause) =>
            ShapesLoadError.make({
              message: `Failed to parse SHACL shapes: ${cause}`,
              cause: O.some(cause),
            })
          )
        );

      const validateWithReport = Effect.fn("ShaclWorkflowService.validateWithReport")(function* (
        dataStore: RdfStore,
        shapesStore: RdfStore
      ) {
        const start = yield* DateTime.now;
        const report = yield* validationService.validate(
          ShaclValidationRequest.make({
            dataset: rdfStoreToDataset(dataStore),
            shapes: [],
            shapesDataset: O.some(rdfStoreToDataset(shapesStore)),
          })
        );
        const end = yield* DateTime.now;
        return ShaclValidationReport.make({
          validation: report,
          validatedAt: start,
          dataGraphTripleCount: NonNegativeInt.make(rdfStoreSize(dataStore)),
          shapesGraphTripleCount: NonNegativeInt.make(rdfStoreSize(shapesStore)),
          durationMs: DateTime.distance(start, end),
        });
      });

      return {
        validateWithReport,
        loadShapes,
        loadShapesFromUri: Effect.fn("ShaclService.loadShapesFromUri")((shapesUri: string) =>
          storage.getOption(stripGsPrefix(shapesUri)).pipe(
            Effect.flatMap((maybeContent) =>
              O.match(maybeContent, {
                onNone: () =>
                  Effect.fail(
                    ShapesLoadError.make({
                      message: `Shapes not found at ${shapesUri}`,
                      shapesUri: O.some(IRI.make(shapesUri)),
                    })
                  ),
                onSome: loadShapes,
              })
            ),
            Effect.mapError((cause) =>
              ShapesLoadError.is(cause)
                ? cause
                : ShapesLoadError.make({
                    message: `Failed to load SHACL shapes from ${shapesUri}: ${cause}`,
                    shapesUri: O.some(IRI.make(shapesUri)),
                    cause: O.some(cause),
                  })
            )
          )
        ),
        generateShapesFromOntology: Effect.fn("ShaclService.generateShapesFromOntology")(function* (
          ontologyStore: RdfStore
        ) {
          const ontologyTurtle = yield* rdfBuilder
            .toTurtle(ontologyStore)
            .pipe(
              Effect.mapError((cause) => ValidationReportError.make({ message: cause.message, cause: O.some(cause) }))
            );
          const ontologyN3 = new N3.Store(new N3.Parser().parse(ontologyTurtle));
          const cacheKey = hashStore(ontologyN3);
          const cache = yield* Ref.get(shapesCache);
          const cached = HashMap.get(cache, cacheKey);
          if (O.isSome(cached)) {
            const clonedStore = new N3.Store();
            for (const quad of cached.value) {
              clonedStore.addQuad(quad);
            }
            return yield* rdfBuilder
              .parseTurtle(serializeN3Store(clonedStore))
              .pipe(
                Effect.mapError((cause) => ValidationReportError.make({ message: cause.message, cause: O.some(cause) }))
              );
          }
          const generatedStore = yield* Effect.try({
            try: () => {
              const store = new N3.Store();
              const { namedNode } = N3.DataFactory;
              const SH = {
                NodeShape: namedNode(`${SHACL_NAMESPACE}NodeShape`),
                PropertyShape: namedNode(`${SHACL_NAMESPACE}PropertyShape`),
                targetClass: namedNode(`${SHACL_NAMESPACE}targetClass`),
                property: namedNode(`${SHACL_NAMESPACE}property`),
                path: namedNode(`${SHACL_NAMESPACE}path`),
                class: namedNode(`${SHACL_NAMESPACE}class`),
                datatype: namedNode(`${SHACL_NAMESPACE}datatype`),
                nodeKind: namedNode(`${SHACL_NAMESPACE}nodeKind`),
                IRI: namedNode(`${SHACL_NAMESPACE}IRI`),
                Literal: namedNode(`${SHACL_NAMESPACE}Literal`),
                minCount: namedNode(`${SHACL_NAMESPACE}minCount`),
                maxCount: namedNode(`${SHACL_NAMESPACE}maxCount`),
              };
              const rdfType = namedNode(RDF_TYPE.value);
              const owlClass = namedNode(OWL_CLASS.value);
              const owlObjectProperty = namedNode(OWL_OBJECT_PROPERTY.value);
              const owlDatatypeProperty = namedNode(OWL_DATATYPE_PROPERTY.value);
              const owlFunctionalProperty = namedNode(`${OWL_NAMESPACE}FunctionalProperty`);
              const owlRestriction = namedNode(`${OWL_NAMESPACE}Restriction`);
              const owlOnProperty = namedNode(`${OWL_NAMESPACE}onProperty`);
              const owlMinCardinality = namedNode(`${OWL_NAMESPACE}minCardinality`);
              const owlMaxCardinality = namedNode(`${OWL_NAMESPACE}maxCardinality`);
              const owlCardinality = namedNode(`${OWL_NAMESPACE}cardinality`);
              const rdfsDomain = namedNode(`${RDFS_NAMESPACE}domain`);
              const rdfsRange = namedNode(`${RDFS_NAMESPACE}range`);
              const rdfsSubClassOf = namedNode(`${RDFS_NAMESPACE}subClassOf`);
              const xsdString = namedNode(XSD_STRING.value);
              const xsdInteger = namedNode(XSD_INTEGER.value);
              const propertyShapeMap = MutableHashMap.empty<string, N3.BlankNode>();
              const makeKey = (classIri: string, propIri: string) => `${classIri}|${propIri}`;
              const classes = ontologyN3.getQuads(null, rdfType, owlClass, null);
              for (const classQuad of classes) {
                const classIri = classQuad.subject;
                const shapeIri = namedNode(`${classIri.value}Shape`);
                store.addQuad(shapeIri, rdfType, SH.NodeShape);
                store.addQuad(shapeIri, SH.targetClass, classIri);
                const propsWithDomain = ontologyN3.getQuads(null, rdfsDomain, classIri, null);
                for (const propQuad of propsWithDomain) {
                  const propIri = propQuad.subject;
                  const isObjectProp = ontologyN3.getQuads(propIri, rdfType, owlObjectProperty, null).length > 0;
                  const isDatatypeProp = ontologyN3.getQuads(propIri, rdfType, owlDatatypeProperty, null).length > 0;
                  const isFunctionalProp =
                    ontologyN3.getQuads(propIri, rdfType, owlFunctionalProperty, null).length > 0;
                  if (isObjectProp) {
                    const propertyShape = N3.DataFactory.blankNode();
                    MutableHashMap.set(propertyShapeMap, makeKey(classIri.value, propIri.value), propertyShape);
                    store.addQuad(shapeIri, SH.property, propertyShape);
                    store.addQuad(propertyShape, SH.path, propIri);
                    const rangeQuads = ontologyN3.getQuads(propIri, rdfsRange, null, null);
                    if (rangeQuads.length > 0) {
                      store.addQuad(propertyShape, SH.class, rangeQuads[0].object);
                    }
                    store.addQuad(propertyShape, SH.nodeKind, SH.IRI);
                    if (isFunctionalProp) {
                      store.addQuad(propertyShape, SH.maxCount, N3.DataFactory.literal("1", xsdInteger));
                    }
                  } else if (isDatatypeProp) {
                    const propertyShape = N3.DataFactory.blankNode();
                    MutableHashMap.set(propertyShapeMap, makeKey(classIri.value, propIri.value), propertyShape);
                    store.addQuad(shapeIri, SH.property, propertyShape);
                    store.addQuad(propertyShape, SH.path, propIri);
                    const rangeQuads = ontologyN3.getQuads(propIri, rdfsRange, null, null);
                    if (rangeQuads.length > 0) {
                      store.addQuad(propertyShape, SH.datatype, rangeQuads[0].object);
                    } else {
                      store.addQuad(propertyShape, SH.datatype, xsdString);
                    }
                    store.addQuad(propertyShape, SH.nodeKind, SH.Literal);
                    if (isFunctionalProp) {
                      store.addQuad(propertyShape, SH.maxCount, N3.DataFactory.literal("1", xsdInteger));
                    }
                  }
                }
                const subClassQuads = ontologyN3.getQuads(classIri, rdfsSubClassOf, null, null);
                for (const subClassQuad of subClassQuads) {
                  const restrictionNode = subClassQuad.object;
                  const isRestriction = ontologyN3.getQuads(restrictionNode, rdfType, owlRestriction, null).length > 0;
                  if (!isRestriction) continue;
                  const onPropertyQuads = ontologyN3.getQuads(restrictionNode, owlOnProperty, null, null);
                  if (onPropertyQuads.length === 0) continue;
                  const restrictedPropIri = onPropertyQuads[0].object;
                  const key = makeKey(classIri.value, restrictedPropIri.value);
                  let propertyShape = MutableHashMap.get(propertyShapeMap, key);
                  if (O.isNone(propertyShape)) {
                    const created = N3.DataFactory.blankNode();
                    MutableHashMap.set(propertyShapeMap, key, created);
                    propertyShape = O.some(created);
                    store.addQuad(shapeIri, SH.property, created);
                    store.addQuad(created, SH.path, restrictedPropIri);
                  }
                  const propertyShapeNode = O.getOrThrow(propertyShape);
                  const minCardQuads = ontologyN3.getQuads(restrictionNode, owlMinCardinality, null, null);
                  if (minCardQuads.length > 0) {
                    const minValue = minCardQuads[0].object.value;
                    store.addQuad(propertyShapeNode, SH.minCount, N3.DataFactory.literal(minValue, xsdInteger));
                  }
                  const maxCardQuads = ontologyN3.getQuads(restrictionNode, owlMaxCardinality, null, null);
                  if (maxCardQuads.length > 0) {
                    const maxValue = maxCardQuads[0].object.value;
                    store.addQuad(propertyShapeNode, SH.maxCount, N3.DataFactory.literal(maxValue, xsdInteger));
                  }
                  const exactCardQuads = ontologyN3.getQuads(restrictionNode, owlCardinality, null, null);
                  if (exactCardQuads.length > 0) {
                    const exactValue = exactCardQuads[0].object.value;
                    store.addQuad(propertyShapeNode, SH.minCount, N3.DataFactory.literal(exactValue, xsdInteger));
                    store.addQuad(propertyShapeNode, SH.maxCount, N3.DataFactory.literal(exactValue, xsdInteger));
                  }
                }
              }
              return store;
            },
            catch: (cause) =>
              ValidationReportError.make({
                message: `Failed to generate shapes from ontology: ${cause}`,
                cause: O.some(cause),
              }),
          });
          const cacheClone = new N3.Store();
          for (const quad of generatedStore) {
            cacheClone.addQuad(quad);
          }
          yield* Ref.update(shapesCache, (map) => HashMap.set(map, cacheKey, cacheClone));
          return yield* rdfBuilder
            .parseTurtle(serializeN3Store(generatedStore))
            .pipe(
              Effect.mapError((cause) => ValidationReportError.make({ message: cause.message, cause: O.some(cause) }))
            );
        }),
        clearShapesCache: Ref.set(shapesCache, HashMap.empty()),
        getShapesCacheStats: Ref.get(shapesCache).pipe(
          Effect.map((cache) => ({
            size: HashMap.size(cache),
            keys: A.fromIterable(HashMap.keys(cache)),
          }))
        ),
        validateWithPolicy: Effect.fn("ShaclService.validateWithPolicy")(function* (dataStore, shapesStore, policy) {
          const validationReport = yield* validateWithReport(dataStore, shapesStore);
          const { violations } = validationReport.validation;
          const violationCount = A.filter(violations, (violation) => violation.severity === "violation").length;
          const warningCount = A.filter(violations, (violation) => violation.severity === "warning").length;
          const failOnViolation = policy.failOnViolation ?? true;
          const failOnWarning = policy.failOnWarning ?? false;
          const logOnly = policy.logOnly ?? false;
          if (logOnly) {
            if (violationCount > 0 || warningCount > 0) {
              yield* Effect.logWarning(
                `SHACL validation: ${violationCount} violation(s), ${warningCount} warning(s) - continuing per logOnly policy`,
                {
                  conforms: validationReport.validation.conforms,
                  violations: A.map(A.take(violations, 5), (violation) => ({
                    focusNode: violation.focusNode,
                    path: violation.path,
                    message: violation.message,
                    severity: violation.severity,
                  })),
                }
              );
            }
            return validationReport;
          }
          if (failOnViolation && violationCount > 0) {
            return yield* ValidationPolicyError.make({
              message: `Validation policy failed: ${violationCount} violation(s) found`,
              violationCount: NonNegativeInt.make(violationCount),
              warningCount: NonNegativeInt.make(warningCount),
              severity: "violation",
            });
          }
          if (failOnWarning && warningCount > 0) {
            return yield* ValidationPolicyError.make({
              message: `Validation policy failed: ${warningCount} warning(s) found`,
              violationCount: NonNegativeInt.make(violationCount),
              warningCount: NonNegativeInt.make(warningCount),
              severity: "warning",
            });
          }
          if (warningCount > 0 && !failOnWarning) {
            yield* Effect.logWarning(
              `SHACL validation: ${warningCount} warning(s) detected but not failing per policy`
            );
          }
          return validationReport;
        }),
      };
    })
  ).pipe(Layer.provide(ShaclValidationServiceLive));
}
