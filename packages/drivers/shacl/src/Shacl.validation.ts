/**
 * shacl-engine-backed SHACL service implementation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/// <reference path="./vendor.d.ts" />

import * as Rdf from "@beep/rdf/Rdf";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_INTEGER } from "@beep/rdf/Vocab/Xsd";
import {
  ShaclValidationError,
  ShaclValidationResult,
  ShaclValidationService,
  ShaclValidationViolation,
} from "@beep/semantic-web/services/shacl-validation";
import { A, O, P, Str } from "@beep/utils";
import { Effect, Layer, Match, pipe } from "effect";
import { ShaclEngineError } from "./Shacl.errors.js";
import type {
  ShaclNodeShape,
  ShaclPropertyShape,
  ShaclValidationRequest,
} from "@beep/semantic-web/services/shacl-validation";
import type * as RdfJsFactory from "@rdfjs/data-model";
import type * as RdfJsDataset from "@rdfjs/dataset";
import type { Validator } from "shacl-engine";

type ShaclEngineModule = {
  readonly Validator: typeof Validator;
};

type RdfJsRuntimeFactory = RdfJsFactory.DataFactory & RdfJsDataset.DatasetFactory;

type RdfJsRuntime = {
  readonly Validator: typeof Validator;
  readonly factory: RdfJsRuntimeFactory;
  readonly targetResolvers: unknown;
};

type ReportShape = {
  readonly conforms: boolean;
  readonly results: ReadonlyArray<unknown>;
};

const SHACL_NAMESPACE = "http://www.w3.org/ns/shacl#" as const;
const SH_NODE_SHAPE = Rdf.makeNamedNode(`${SHACL_NAMESPACE}NodeShape`);
const SH_PROPERTY = Rdf.makeNamedNode(`${SHACL_NAMESPACE}property`);
const SH_PATH = Rdf.makeNamedNode(`${SHACL_NAMESPACE}path`);
const SH_TARGET_CLASS = Rdf.makeNamedNode(`${SHACL_NAMESPACE}targetClass`);
const SH_TARGET_NODE = Rdf.makeNamedNode(`${SHACL_NAMESPACE}targetNode`);
const SH_MIN_COUNT = Rdf.makeNamedNode(`${SHACL_NAMESPACE}minCount`);
const SH_MAX_COUNT = Rdf.makeNamedNode(`${SHACL_NAMESPACE}maxCount`);
const SH_DATATYPE = Rdf.makeNamedNode(`${SHACL_NAMESPACE}datatype`);
const SH_CLASS = Rdf.makeNamedNode(`${SHACL_NAMESPACE}class`);
const SH_HAS_VALUE = Rdf.makeNamedNode(`${SHACL_NAMESPACE}hasValue`);
const SH_INFO = `${SHACL_NAMESPACE}Info`;
const SH_WARNING = `${SHACL_NAMESPACE}Warning`;
const UNKNOWN_PATH = Rdf.makeNamedNode("urn:beep:shacl:path:unknown");

const unknownMessage = (cause: unknown, fallback: string): string =>
  P.hasProperty(cause, "message") && P.isString(cause.message) ? cause.message : fallback;

const driverError =
  (reason: ShaclEngineError["reason"], fallback: string) =>
  (cause: unknown): ShaclEngineError =>
    ShaclEngineError.make({
      reason,
      message: unknownMessage(cause, fallback),
    });

const semanticError = (error: ShaclEngineError): ShaclValidationError =>
  ShaclValidationError.make({
    reason: error.reason === "validationFailed" ? "engineFailure" : "invalidShape",
    message: error.message,
  });

const adapterInvariant = (message: string): ShaclEngineError =>
  ShaclEngineError.make({
    reason: "adapterInvariant",
    message,
  });

const isShaclEngineModule = (value: unknown): value is ShaclEngineModule =>
  P.isObject(value) && P.hasProperty(value, "Validator") && P.isFunction(value.Validator);

const makeRuntimeFactory = (
  factory: RdfJsFactory.DataFactory,
  datasetFactory: RdfJsDataset.DatasetFactory
): RdfJsRuntimeFactory => ({
  namedNode: factory.namedNode.bind(factory),
  blankNode: factory.blankNode.bind(factory),
  defaultGraph: factory.defaultGraph.bind(factory),
  literal: factory.literal.bind(factory),
  quad: factory.quad.bind(factory),
  variable: factory.variable.bind(factory),
  dataset: datasetFactory.dataset.bind(datasetFactory),
});

const loadShaclRuntime = Effect.tryPromise({
  try: () =>
    Promise.all([
      import("shacl-engine"),
      import("shacl-engine/sparql.js"),
      import("@rdfjs/data-model"),
      import("@rdfjs/dataset"),
    ]),
  catch: driverError("importFailed", "Failed to import shacl-engine runtime packages."),
}).pipe(
  Effect.flatMap(([engine, sparql, dataModel, datasetModule]) => {
    if (!isShaclEngineModule(engine)) {
      return Effect.fail(adapterInvariant("Invalid shacl-engine module."));
    }
    return Effect.succeed({
      Validator: engine.Validator,
      factory: makeRuntimeFactory(dataModel.default, datasetModule.default),
      targetResolvers: sparql.targetResolvers,
    } satisfies RdfJsRuntime);
  })
);

const toRdfJsSubject = (factory: RdfJsFactory.DataFactory, subject: Rdf.Subject): RdfJsFactory.Subject =>
  Rdf.Subject.match(subject, {
    NamedNode: (value) => factory.namedNode(value.value),
    BlankNode: (value) => factory.blankNode(value.value),
  });

const toRdfJsLiteral = (factory: RdfJsFactory.DataFactory, value: Rdf.Literal): RdfJsFactory.Literal =>
  pipe(
    value.language,
    O.match({
      onNone: () => factory.literal(value.value, factory.namedNode(value.datatype.value)),
      onSome: (language) => factory.literal(value.value, language),
    })
  );

const toRdfJsObject = (factory: RdfJsFactory.DataFactory, object: Rdf.ObjectTerm): RdfJsFactory.Object =>
  Rdf.ObjectTerm.match(object, {
    NamedNode: (value) => factory.namedNode(value.value),
    BlankNode: (value) => factory.blankNode(value.value),
    Literal: (value) => toRdfJsLiteral(factory, value),
  });

const toRdfJsGraph = (factory: RdfJsFactory.DataFactory, graph: Rdf.GraphTerm): RdfJsFactory.Graph =>
  Rdf.GraphTerm.match(graph, {
    DefaultGraph: () => factory.defaultGraph(),
    NamedNode: (value) => factory.namedNode(value.value),
    BlankNode: (value) => factory.blankNode(value.value),
  });

const toRdfJsQuad = (factory: RdfJsFactory.DataFactory, quad: Rdf.Quad): RdfJsFactory.Quad =>
  factory.quad(
    toRdfJsSubject(factory, quad.subject),
    factory.namedNode(quad.predicate.value),
    toRdfJsObject(factory, quad.object),
    toRdfJsGraph(factory, quad.graph)
  );

const toRdfJsDataset = (
  runtime: RdfJsRuntime,
  dataset: Rdf.Dataset
): Effect.Effect<RdfJsDataset.DatasetCore, ShaclEngineError> => {
  const target = runtime.factory.dataset();
  return Effect.forEach(
    dataset.quads,
    (quad) =>
      Effect.try({
        try: () => target.add(toRdfJsQuad(runtime.factory, quad)),
        catch: driverError("datasetLoadFailed", "Failed to load a quad into the SHACL engine dataset."),
      }),
    { discard: true }
  ).pipe(Effect.as(target));
};

const property = (value: unknown, key: string): O.Option<unknown> =>
  P.isObject(value) && key in value ? O.some((value as Record<string, unknown>)[key]) : O.none();

const stringProperty = (value: unknown, key: string): O.Option<string> =>
  pipe(property(value, key), O.filter(P.isString));

const termValue = (value: unknown): O.Option<string> => stringProperty(value, "value");

const namedNodeFromUnknown = (value: unknown): O.Option<Rdf.NamedNode> =>
  pipe(
    stringProperty(value, "termType"),
    O.filter((termType) => termType === "NamedNode"),
    O.flatMap(() => termValue(value)),
    O.map(Rdf.makeNamedNode)
  );

const namedNodeLikeFromUnknown = (value: unknown): O.Option<Rdf.NamedNode> =>
  pipe(
    namedNodeFromUnknown(value),
    O.orElse(() => pipe(property(value, "term"), O.flatMap(namedNodeFromUnknown))),
    O.orElse(() => pipe(property(value, "ptr"), O.flatMap(namedNodeLikeFromUnknown)))
  );

const objectTermFromUnknown = (value: unknown): O.Option<Rdf.ObjectTerm> =>
  pipe(
    stringProperty(value, "termType"),
    O.flatMap((termType) =>
      Match.value(termType).pipe(
        Match.when("NamedNode", () => pipe(termValue(value), O.map(Rdf.makeNamedNode))),
        Match.when("BlankNode", () => pipe(termValue(value), O.map(Rdf.makeBlankNode))),
        Match.when("Literal", () =>
          pipe(
            O.all({
              datatype: pipe(property(value, "datatype"), O.flatMap(namedNodeLikeFromUnknown)),
              lexical: termValue(value),
            }),
            O.map(({ datatype, lexical }) =>
              Rdf.makeLiteral(lexical, datatype.value, {
                ...O.getSomesStruct({ language: pipe(stringProperty(value, "language"), O.filter(Str.isNonEmpty)) }),
              })
            )
          )
        ),
        Match.orElse(O.none<Rdf.ObjectTerm>)
      )
    ),
    O.orElse(() => pipe(property(value, "term"), O.flatMap(objectTermFromUnknown))),
    O.orElse(() => pipe(property(value, "ptr"), O.flatMap(objectTermFromUnknown)))
  );

const focusNodeFromUnknown = (value: unknown): O.Option<string> =>
  pipe(property(value, "focusNode"), O.flatMap(termValue));

const arrayHead = (value: unknown): O.Option<unknown> => (A.isArray(value) ? A.head(value) : O.none());

const pathStepPredicateFromUnknown = (value: unknown): O.Option<Rdf.NamedNode> =>
  pipe(property(value, "predicates"), O.flatMap(arrayHead), O.flatMap(namedNodeLikeFromUnknown));

const pathFromUnknown = (value: unknown): Rdf.NamedNode =>
  pipe(
    property(value, "path"),
    O.flatMap((path) =>
      pipe(
        namedNodeLikeFromUnknown(path),
        O.orElse(() => pathStepPredicateFromUnknown(path)),
        O.orElse(() => pipe(arrayHead(path), O.flatMap(pathStepPredicateFromUnknown)))
      )
    ),
    O.getOrElse(() => UNKNOWN_PATH)
  );

const sourceShapeFromUnknown = (value: unknown): O.Option<Rdf.NamedNode> =>
  pipe(
    property(value, "sourceShape"),
    O.orElse(() => property(value, "shape")),
    O.flatMap(namedNodeLikeFromUnknown)
  );

const sourceConstraintComponentFromUnknown = (value: unknown): O.Option<Rdf.NamedNode> =>
  pipe(property(value, "constraintComponent"), O.flatMap(namedNodeLikeFromUnknown));

const resultValueFromUnknown = (value: unknown): O.Option<Rdf.ObjectTerm> =>
  pipe(property(value, "value"), O.flatMap(objectTermFromUnknown));

const severityFromUnknown = (value: unknown): ShaclValidationViolation["severity"] =>
  pipe(
    property(value, "severity"),
    O.flatMap(termValue),
    O.map((severityIri) =>
      Match.value(severityIri).pipe(
        Match.when(SH_INFO, () => "info" as const),
        Match.when(SH_WARNING, () => "warning" as const),
        Match.orElse(() => "violation" as const)
      )
    ),
    O.getOrElse(() => "violation" as const)
  );

const messageFromUnknown = (value: unknown): string =>
  pipe(
    stringProperty(value, "message"),
    O.orElse(() => pipe(property(value, "message"), O.flatMap(arrayHead), O.flatMap(termValue))),
    O.orElse(() => stringProperty(value, "resultMessage")),
    O.getOrElse(() => "SHACL validation violation.")
  );

const reportFromUnknown = (value: unknown): Effect.Effect<ReportShape, ShaclEngineError> => {
  if (!P.isObject(value)) {
    return Effect.fail(adapterInvariant("SHACL engine returned a non-object report."));
  }
  const conforms = pipe(
    property(value, "conforms"),
    O.filter(P.isBoolean),
    O.getOrElse(() => false)
  );
  const results = pipe(
    property(value, "results"),
    O.filter((candidate): candidate is ReadonlyArray<unknown> => A.isArray(candidate)),
    O.getOrElse(A.empty<unknown>)
  );
  return Effect.succeed({ conforms, results });
};

const violationFromUnknown = (value: unknown): ShaclValidationViolation =>
  ShaclValidationViolation.make({
    focusNode: pipe(
      focusNodeFromUnknown(value),
      O.getOrElse(() => "urn:beep:shacl:focus:unknown")
    ),
    path: pathFromUnknown(value),
    message: messageFromUnknown(value),
    severity: severityFromUnknown(value),
    sourceShape: sourceShapeFromUnknown(value),
    sourceConstraintComponent: sourceConstraintComponentFromUnknown(value),
    value: resultValueFromUnknown(value),
  });

const shapeSubject = (shape: ShaclNodeShape, index: number): Rdf.Subject =>
  pipe(
    shape.id,
    O.getOrElse(() => Rdf.makeBlankNode(`shape-${index}`))
  );

const propertySubject = (shapeIndex: number, propertyIndex: number): Rdf.Subject =>
  Rdf.makeBlankNode(`shape-${shapeIndex}-property-${propertyIndex}`);

const integerLiteral = (value: number): Rdf.Literal => Rdf.makeLiteral(`${value}`, XSD_INTEGER.value);

const typedPropertyShapeQuads = (
  node: Rdf.Subject,
  propertyShape: ShaclPropertyShape,
  shapeIndex: number,
  propertyIndex: number
): ReadonlyArray<Rdf.Quad> => {
  const propertyNode = propertySubject(shapeIndex, propertyIndex);
  return pipe(
    [
      Rdf.makeQuad(node, SH_PROPERTY, propertyNode),
      Rdf.makeQuad(propertyNode, SH_PATH, propertyShape.path),
      ...pipe(
        propertyShape.minCount,
        O.map((count) => [Rdf.makeQuad(propertyNode, SH_MIN_COUNT, integerLiteral(count))]),
        O.getOrElse(A.empty<Rdf.Quad>)
      ),
      ...pipe(
        propertyShape.maxCount,
        O.map((count) => [Rdf.makeQuad(propertyNode, SH_MAX_COUNT, integerLiteral(count))]),
        O.getOrElse(A.empty<Rdf.Quad>)
      ),
      ...pipe(
        propertyShape.datatype,
        O.map((datatype) => [Rdf.makeQuad(propertyNode, SH_DATATYPE, datatype)]),
        O.getOrElse(A.empty<Rdf.Quad>)
      ),
      ...pipe(
        propertyShape.class,
        O.map((classNode) => [Rdf.makeQuad(propertyNode, SH_CLASS, classNode)]),
        O.getOrElse(A.empty<Rdf.Quad>)
      ),
      ...pipe(
        propertyShape.hasValue,
        O.map((value) => [Rdf.makeQuad(propertyNode, SH_HAS_VALUE, value)]),
        O.getOrElse(A.empty<Rdf.Quad>)
      ),
    ],
    A.fromIterable
  );
};

const typedNodeShapeQuads = (shape: ShaclNodeShape, shapeIndex: number): ReadonlyArray<Rdf.Quad> => {
  const node = shapeSubject(shape, shapeIndex);
  return [
    Rdf.makeQuad(node, RDF_TYPE, SH_NODE_SHAPE),
    ...pipe(
      shape.targetClass,
      O.map((targetClass) => [Rdf.makeQuad(node, SH_TARGET_CLASS, targetClass)]),
      O.getOrElse(A.empty<Rdf.Quad>)
    ),
    ...pipe(
      shape.targetNode,
      O.map((targetNode) => [Rdf.makeQuad(node, SH_TARGET_NODE, targetNode)]),
      O.getOrElse(A.empty<Rdf.Quad>)
    ),
    ...pipe(
      shape.properties,
      A.flatMap((propertyShape, propertyIndex) =>
        typedPropertyShapeQuads(node, propertyShape, shapeIndex, propertyIndex)
      )
    ),
  ];
};

const shapesDataset = (request: ShaclValidationRequest): Rdf.Dataset =>
  pipe(
    request.shapesDataset,
    O.getOrElse(() =>
      Rdf.makeDataset(
        pipe(
          request.shapes,
          A.flatMap((shape, shapeIndex) => typedNodeShapeQuads(shape, shapeIndex))
        )
      )
    )
  );

const validateShacl = Effect.fn("Shacl.validate")(function* (request: ShaclValidationRequest) {
  const runtime = yield* loadShaclRuntime;
  const shapes = yield* toRdfJsDataset(runtime, shapesDataset(request));
  const data = yield* toRdfJsDataset(runtime, request.dataset);
  const validator = new runtime.Validator(shapes, {
    factory: runtime.factory,
    targetResolvers: runtime.targetResolvers,
  });
  const rawReport = yield* Effect.tryPromise({
    try: () => validator.validate({ dataset: data }),
    catch: driverError("validationFailed", "shacl-engine failed to validate the dataset."),
  });
  const report = yield* reportFromUnknown(rawReport);
  const maxResults = pipe(
    request.maxResults,
    O.getOrElse(() => report.results.length)
  );
  const violations = pipe(report.results, A.map(violationFromUnknown), A.take(maxResults));

  return ShaclValidationResult.make({
    conforms: report.conforms && violations.length === 0,
    violations,
    truncated: report.results.length > violations.length,
  });
});

/**
 * Live SHACL service Layer backed by shacl-engine.
 *
 * @remarks
 * `shacl-engine` and RDFJS support packages are imported lazily during
 * validation so this Layer remains safe to import in browser bundles and
 * workers before a validation run actually starts.
 *
 * @example
 * ```ts
 * import { ShaclValidationServiceLive } from "@beep/shacl"
 *
 * console.log(ShaclValidationServiceLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ShaclValidationServiceLive = Layer.succeed(
  ShaclValidationService,
  ShaclValidationService.of({
    validate: Effect.fn("ShaclValidationService.validate")((request) =>
      validateShacl(request).pipe(Effect.mapError(semanticError))
    ),
  })
);
