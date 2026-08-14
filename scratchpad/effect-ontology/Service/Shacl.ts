/**
 * Service: SHACL Validation
 *
 * Provides SHACL validation capabilities using shacl-engine with Effect
 * integration. Handles shape loading, validation execution, and report mapping.
 *
 * @since 2.0.0
 * @module Service/Shacl
 */

import { $ScratchpadId } from "@beep/identity";
import * as Rdf from "@beep/rdf/Rdf";
import { OWL_CLASS, OWL_DATATYPE_PROPERTY, OWL_NAMESPACE, OWL_OBJECT_PROPERTY } from "@beep/rdf/Vocab/Owl";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs";
import { XSD_INTEGER, XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { NonNegativeInt } from "@beep/schema/Int";
import { ShaclValidationResult } from "@beep/semantic-web/services/shacl-validation";
import { Context, DateTime, Duration, Effect, HashMap, Layer, MutableHashMap, Order, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as N3 from "n3";
import { Validator as ShaclValidator } from "shacl-engine";
// @ts-expect-error - shacl-engine/sparql.js has no type declarations
import { validations as sparqlValidations } from "shacl-engine/sparql.ts";
import {
  ShaclValidationError,
  ShapesLoadError,
  ValidationPolicyError,
  ValidationReportError,
} from "../Domain/Error/Shacl.ts";
import { ShaclValidationReport, ShaclViolation, ValidationPolicy } from "../Domain/Schema/Shacl.ts";
import { sha256Sync } from "../Utils/Hash.ts";
import type { RdfStore } from "./Rdf.ts";
import { RdfBuilder } from "./Rdf.ts";
import { StorageService } from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Shacl");
const SHACL_NAMESPACE = "http://www.w3.org/ns/shacl#";

// Re-export types for backward compatibility
export { ShaclValidationReport, ShaclViolation, ValidationPolicy };

const mapSeverity = (severity: { value?: string } | undefined): "violation" | "warning" | "info" => {
  if (P.isUndefined(severity?.value)) return "info";
  if (Str.endsWith("Violation")(severity.value)) return "violation";
  if (Str.endsWith("Warning")(severity.value)) return "warning";
  return "info";
};

/**
 * Extract a string message from SHACL validation result message.
 * Messages can be:
 * - A string directly
 * - An array of strings
 * - An array of RDF literal objects with .value property
 * - An RDF literal object with .value property
 */
const extractMessage = (message: unknown): string => {
  if (P.not(P.isTruthy)(message)) return "Constraint violation";

  // Handle string directly
  if (typeof message === "string") return message;

  // Handle array
  if (A.isArray(message)) {
    const firstMsg = message[0];
    if (P.not(P.isTruthy)(firstMsg)) return "Constraint violation";
    // Array element could be string or object with .value
    if (typeof firstMsg === "string") return firstMsg;
    if (typeof firstMsg === "object" && firstMsg !== null && "value" in firstMsg) {
      return String((firstMsg as { value: unknown }).value);
    }
    return String(firstMsg);
  }

  // Handle object with .value property (RDF literal)
  if (typeof message === "object" && message !== null && "value" in message) {
    return String((message as { value: unknown }).value);
  }

  // Fallback
  return String(message);
};

const stripGsPrefix = (uri: string): string =>
  Str.startsWith("gs://")(uri) ? Str.replace(/^gs:\/\/[^/]+\//, "")(uri) : uri;

/**
 * Compute a hash key for an N3 store by serializing to N-Quads
 * N-Quads is a canonical format so identical graphs produce identical hashes
 */
const hashStore = (store: N3.Store): string => {
  const writer = new N3.Writer({ format: "N-Quads" });
  for (const quad of store) {
    writer.addQuad(quad);
  }
  let nquads = "";
  writer.end((_error, result) => {
    nquads = result;
  });
  // Sort lines for canonical ordering (N-Quads lines are independent)
  const sortedNquads = A.join(A.sort(Str.split("\n")(nquads), Order.String), "\n");
  return sha256Sync(sortedNquads);
};

const UNKNOWN_PATH = Rdf.makeNamedNode("urn:beep:shacl:path:unknown");

const optionalNamedNode = (term: { value?: string } | undefined): O.Option<Rdf.NamedNode> =>
  P.isString(term?.value) ? O.some(Rdf.makeNamedNode(term.value)) : O.none();

interface LegacyObjectTerm {
  readonly termType?: string;
  readonly value?: string;
  readonly language?: string;
  readonly datatype?: { readonly value?: string };
  readonly term?: LegacyObjectTerm;
  readonly terms?: ReadonlyArray<LegacyObjectTerm>;
}

const unwrapLegacyTerm = (term: LegacyObjectTerm): LegacyObjectTerm => term.term ?? term.terms?.[0] ?? term;

const optionalObjectTerm = (term: LegacyObjectTerm | undefined): O.Option<Rdf.ObjectTerm> => {
  if (P.isUndefined(term)) return O.none();
  const candidate = unwrapLegacyTerm(term);
  if (!P.isString(candidate.value)) return O.none();
  switch (candidate.termType) {
    case "NamedNode":
      return O.some(Rdf.makeNamedNode(candidate.value));
    case "BlankNode":
      return O.some(Rdf.makeBlankNode(candidate.value));
    case "Literal":
      return O.some(
        Rdf.makeLiteral(
          candidate.value,
          candidate.datatype?.value ?? XSD_STRING.value,
          P.isString(candidate.language) && Str.isNonEmpty(candidate.language) ? { language: candidate.language } : {}
        )
      );
    default:
      return O.some(Rdf.makeLiteral(candidate.value, XSD_STRING.value));
  }
};

/** Explicit legacy ingress adapter from shacl-engine RDF/JS results. */
interface LegacyShaclResult {
  readonly focusNode?: { readonly value?: string };
  readonly path?: { readonly value?: string };
  readonly value?: LegacyObjectTerm;
  readonly message?: unknown;
  readonly severity?: { readonly value?: string };
  readonly sourceShape?: { readonly value?: string };
  readonly sourceConstraintComponent?: { readonly value?: string };
}

const legacyResultToCanonicalViolation = (result: LegacyShaclResult): ShaclViolation =>
  ShaclViolation.make({
    focusNode: result.focusNode?.value ?? "urn:beep:shacl:focus:unknown",
    path: P.isString(result.path?.value) ? Rdf.makeNamedNode(result.path.value) : UNKNOWN_PATH,
    value: optionalObjectTerm(result.value),
    message: extractMessage(result.message),
    severity: mapSeverity(result.severity),
    sourceShape: optionalNamedNode(result.sourceShape),
    sourceConstraintComponent: optionalNamedNode(result.sourceConstraintComponent),
  });

export interface ShaclServiceMethods {
  readonly validate: (
    dataStore: RdfStore["_store"],
    shapesStore: N3.Store
  ) => Effect.Effect<ShaclValidationReport, ShaclValidationError>;

  readonly loadShapes: (shapesTurtle: string) => Effect.Effect<N3.Store, ShapesLoadError>;

  readonly loadShapesFromUri: (shapesUri: string) => Effect.Effect<N3.Store, ShapesLoadError>;

  readonly generateShapesFromOntology: (
    ontologyStore: RdfStore["_store"]
  ) => Effect.Effect<N3.Store, ValidationReportError>;

  /**
   * Clear the shapes cache. Useful for testing or when ontology has changed.
   *
   * @since 2.0.0
   */
  readonly clearShapesCache: Effect.Effect<void>;

  /**
   * Get cache statistics for monitoring
   *
   * @since 2.0.0
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
   * @since 2.0.0
   */
  readonly validateWithPolicy: (
    dataStore: RdfStore["_store"],
    shapesStore: N3.Store,
    policy: ValidationPolicy
  ) => Effect.Effect<ShaclValidationReport, ShaclValidationError | ValidationPolicyError>;
}

/**
 * Configuration for ShaclService.Test layer
 *
 * @since 2.0.0
 * @category Test
 */
export interface ShaclServiceTestConfig {
  /** Whether validation should report conformance (default: true) */
  readonly conforms?: boolean;
  /** Mock violations to return (default: []) */
  readonly violations?: ReadonlyArray<ShaclViolation>;
}

/**
 * Default test configuration - always conforms with no violations
 *
 * @since 2.0.0
 * @category Test
 */
export const defaultTestConfig: ShaclServiceTestConfig = {
  conforms: true,
  violations: [],
};

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
   *     severity: "violation"
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
      Effect.gen(function* () {
        const conforms = config.conforms ?? true;
        const violations = config.violations ?? [];

        // Track shapes cache for getShapesCacheStats
        const shapesCache = yield* Ref.make(HashMap.empty<string, N3.Store>());

        const makeReport = (dataStore: N3.Store, shapesStore: N3.Store): Effect.Effect<ShaclValidationReport> =>
          Effect.gen(function* () {
            const now = yield* DateTime.now;
            return ShaclValidationReport.make({
              validation: ShaclValidationResult.make({ conforms, violations, truncated: false }),
              validatedAt: now,
              dataGraphTripleCount: NonNegativeInt.make(dataStore.size),
              shapesGraphTripleCount: NonNegativeInt.make(shapesStore.size),
              durationMs: Duration.zero,
            });
          });

        return {
          validate: Effect.fn("ShaclService.validate")((dataStore, shapesStore) => makeReport(dataStore, shapesStore)),
          loadShapes: Effect.fn("ShaclService.loadShapes")((_shapesTurtle) => Effect.succeed(new N3.Store())),
          loadShapesFromUri: Effect.fn("ShaclService.loadShapesFromUri")((_shapesUri) =>
            Effect.succeed(new N3.Store())
          ),
          generateShapesFromOntology: Effect.fn("ShaclService.generateShapesFromOntology")(function* (ontologyStore) {
            const cacheKey = `test-${ontologyStore.size}`;
            const store = new N3.Store();
            yield* Ref.update(shapesCache, (map) => HashMap.set(map, cacheKey, store));
            return store;
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

  static readonly Default: Layer.Layer<ShaclService, never, RdfBuilder | StorageService> = Layer.effect(
    ShaclService,
    Effect.gen(function* () {
      const rdfBuilder = yield* RdfBuilder;
      const storage = yield* StorageService;

      // Cache for generated SHACL shapes, keyed by ontology content hash
      const shapesCache = yield* Ref.make(HashMap.empty<string, N3.Store>());

      const loadShapes = (shapesTurtle: string) =>
        rdfBuilder.parseTurtle(shapesTurtle).pipe(
          Effect.map((store) => store._store),
          Effect.mapError((cause) =>
            ShapesLoadError.make({
              message: `Failed to parse SHACL shapes: ${cause}`,
              cause: O.some(cause),
            })
          )
        );

      return {
        validate: Effect.fn("ShaclService.validate")(function* (dataStore, shapesStore) {
          const start = yield* DateTime.now;
          const validator = yield* Effect.try({
            try: () =>
              new ShaclValidator(shapesStore, {
                factory: N3.DataFactory,
                debug: false,
                coverage: false,
                validations: sparqlValidations,
              }),
            catch: (cause) =>
              ShaclValidationError.make({
                reason: "engineFailure",
                message: `Failed to create SHACL validator: ${cause}`,
              }),
          });
          const report = yield* Effect.tryPromise({
            try: () => validator.validate({ dataset: dataStore }),
            catch: (cause) =>
              ShaclValidationError.make({
                reason: "engineFailure",
                message: `SHACL validation failed: ${cause}`,
              }),
          });
          const end = yield* DateTime.now;
          return ShaclValidationReport.make({
            validation: ShaclValidationResult.make({
              conforms: report.conforms,
              violations: A.map(report.results ?? [], legacyResultToCanonicalViolation),
              truncated: false,
            }),
            validatedAt: start,
            dataGraphTripleCount: NonNegativeInt.make(dataStore.size),
            shapesGraphTripleCount: NonNegativeInt.make(shapesStore.size),
            durationMs: DateTime.distance(start, end),
          });
        }),
        loadShapes,
        loadShapesFromUri: Effect.fn("ShaclService.loadShapesFromUri")((shapesUri: string) =>
          storage.get(stripGsPrefix(shapesUri)).pipe(
            Effect.flatMap((maybeContent) =>
              O.match(O.fromNullishOr(maybeContent), {
                onNone: () =>
                  Effect.fail(
                    ShapesLoadError.fromUnknown({
                      message: `Shapes not found at ${shapesUri}`,
                      shapesUri,
                    })
                  ),
                onSome: loadShapes,
              })
            ),
            Effect.mapError((cause) =>
              S.is(ShapesLoadError)(cause)
                ? cause
                : ShapesLoadError.fromUnknown({
                    message: `Failed to load SHACL shapes from ${shapesUri}: ${cause}`,
                    shapesUri,
                    cause,
                  })
            )
          )
        ),
        generateShapesFromOntology: Effect.fn("ShaclService.generateShapesFromOntology")(function* (
          ontologyStore: RdfStore["_store"]
        ) {
          const cacheKey = hashStore(ontologyStore);
          const cache = yield* Ref.get(shapesCache);
          const cached = HashMap.get(cache, cacheKey);
          if (O.isSome(cached)) {
            const clonedStore = new N3.Store();
            for (const quad of cached.value) {
              clonedStore.addQuad(quad);
            }
            return clonedStore;
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
              const classes = ontologyStore.getQuads(null, rdfType, owlClass, null);
              for (const classQuad of classes) {
                const classIri = classQuad.subject;
                const shapeIri = namedNode(`${classIri.value}Shape`);
                store.addQuad(shapeIri, rdfType, SH.NodeShape);
                store.addQuad(shapeIri, SH.targetClass, classIri);
                const propsWithDomain = ontologyStore.getQuads(null, rdfsDomain, classIri, null);
                for (const propQuad of propsWithDomain) {
                  const propIri = propQuad.subject;
                  const isObjectProp = ontologyStore.getQuads(propIri, rdfType, owlObjectProperty, null).length > 0;
                  const isDatatypeProp = ontologyStore.getQuads(propIri, rdfType, owlDatatypeProperty, null).length > 0;
                  const isFunctionalProp =
                    ontologyStore.getQuads(propIri, rdfType, owlFunctionalProperty, null).length > 0;
                  if (isObjectProp) {
                    const propertyShape = N3.DataFactory.blankNode();
                    MutableHashMap.set(propertyShapeMap, makeKey(classIri.value, propIri.value), propertyShape);
                    store.addQuad(shapeIri, SH.property, propertyShape);
                    store.addQuad(propertyShape, SH.path, propIri);
                    const rangeQuads = ontologyStore.getQuads(propIri, rdfsRange, null, null);
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
                    const rangeQuads = ontologyStore.getQuads(propIri, rdfsRange, null, null);
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
                const subClassQuads = ontologyStore.getQuads(classIri, rdfsSubClassOf, null, null);
                for (const subClassQuad of subClassQuads) {
                  const restrictionNode = subClassQuad.object;
                  const isRestriction =
                    ontologyStore.getQuads(restrictionNode, rdfType, owlRestriction, null).length > 0;
                  if (!isRestriction) continue;
                  const onPropertyQuads = ontologyStore.getQuads(restrictionNode, owlOnProperty, null, null);
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
                  const minCardQuads = ontologyStore.getQuads(restrictionNode, owlMinCardinality, null, null);
                  if (minCardQuads.length > 0) {
                    const minValue = minCardQuads[0].object.value;
                    store.addQuad(propertyShapeNode, SH.minCount, N3.DataFactory.literal(minValue, xsdInteger));
                  }
                  const maxCardQuads = ontologyStore.getQuads(restrictionNode, owlMaxCardinality, null, null);
                  if (maxCardQuads.length > 0) {
                    const maxValue = maxCardQuads[0].object.value;
                    store.addQuad(propertyShapeNode, SH.maxCount, N3.DataFactory.literal(maxValue, xsdInteger));
                  }
                  const exactCardQuads = ontologyStore.getQuads(restrictionNode, owlCardinality, null, null);
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
          return generatedStore;
        }),
        clearShapesCache: Ref.set(shapesCache, HashMap.empty()),
        getShapesCacheStats: Ref.get(shapesCache).pipe(
          Effect.map((cache) => ({
            size: HashMap.size(cache),
            keys: A.fromIterable(HashMap.keys(cache)),
          }))
        ),
        validateWithPolicy: Effect.fn("ShaclService.validateWithPolicy")(function* (dataStore, shapesStore, policy) {
          const validator = yield* Effect.try({
            try: () =>
              new ShaclValidator(shapesStore, {
                factory: N3.DataFactory,
                debug: false,
                coverage: false,
                validations: sparqlValidations,
              }),
            catch: (cause) =>
              ShaclValidationError.make({
                reason: "engineFailure",
                message: `Failed to create SHACL validator: ${cause}`,
              }),
          });
          const start = yield* DateTime.now;
          const report = yield* Effect.tryPromise({
            try: () => validator.validate({ dataset: dataStore }),
            catch: (cause) =>
              ShaclValidationError.make({
                reason: "engineFailure",
                message: `SHACL validation failed: ${cause}`,
              }),
          });
          const end = yield* DateTime.now;
          const violations = A.map(report.results ?? [], legacyResultToCanonicalViolation);
          const validationReport = ShaclValidationReport.make({
            validation: ShaclValidationResult.make({ conforms: report.conforms, violations, truncated: false }),
            validatedAt: start,
            dataGraphTripleCount: NonNegativeInt.make(dataStore.size),
            shapesGraphTripleCount: NonNegativeInt.make(shapesStore.size),
            durationMs: DateTime.distance(start, end),
          });
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
                  conforms: report.conforms,
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
  );
}
