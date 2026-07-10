/**
 * Domain-native structural inference for ontology sessions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { make as makeIdentity } from "@beep/identity";
import {
  deriveSessionGraphPartitions,
  graphPartitionIri,
  Session,
  SessionGraphPartitions,
} from "@beep/ontology-domain/aggregates/Session";
import {
  BlankNode,
  Dataset,
  makeDataset,
  makeNamedNode,
  makeQuad,
  ObjectTerm,
  Quad,
  Subject,
  serializeQuad,
  serializeTerm,
} from "@beep/rdf/Rdf";
import { OWL_NAMESPACE } from "@beep/rdf/Vocab/Owl";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import { Context, Effect, flow, Layer, MutableHashMap, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { NamedNode } from "@beep/rdf/Rdf";

const { $OntologyUseCasesId } = makeIdentity("ontology-use-cases");
const $I = $OntologyUseCasesId.create("aggregates/Session/Session.reasoner");

const RDFS_SUB_CLASS_OF = makeNamedNode(`${RDFS_NAMESPACE}subClassOf`);
const RDFS_SUB_PROPERTY_OF = makeNamedNode(`${RDFS_NAMESPACE}subPropertyOf`);
const RDFS_DOMAIN = makeNamedNode(`${RDFS_NAMESPACE}domain`);
const RDFS_RANGE = makeNamedNode(`${RDFS_NAMESPACE}range`);
const OWL_DISJOINT_WITH = makeNamedNode(`${OWL_NAMESPACE}disjointWith`);
const INFERRED_GRAPH = makeNamedNode(graphPartitionIri("inferred"));

/**
 * Structural inference module.
 *
 * @example
 * ```ts
 * import { OntologyInferenceModule } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const module: OntologyInferenceModule = "closure"
 *
 * console.log(module)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const OntologyInferenceModule = LiteralKit(["closure", "domainRange", "disjointness"]).pipe(
  $I.annoteSchema("OntologyInferenceModule", {
    description: "Structural inference module.",
  })
);

/**
 * Type for {@link OntologyInferenceModule}.
 *
 * @example
 * ```ts
 * import { OntologyInferenceModule } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const module: OntologyInferenceModule = "domainRange"
 *
 * console.log(module)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export type OntologyInferenceModule = typeof OntologyInferenceModule.Type;

/**
 * Inference recompute mode for a module.
 *
 * @example
 * ```ts
 * import { OntologyInferenceRecomputeMode } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const mode: OntologyInferenceRecomputeMode = "incremental"
 *
 * console.log(mode)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const OntologyInferenceRecomputeMode = LiteralKit(["full", "incremental", "reused"]).pipe(
  $I.annoteSchema("OntologyInferenceRecomputeMode", {
    description: "Inference recompute mode for a module.",
  })
);

/**
 * Type for {@link OntologyInferenceRecomputeMode}.
 *
 * @example
 * ```ts
 * import { OntologyInferenceRecomputeMode } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const mode: OntologyInferenceRecomputeMode = "full"
 *
 * console.log(mode)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export type OntologyInferenceRecomputeMode = typeof OntologyInferenceRecomputeMode.Type;

/**
 * Changed signature role used by inference invalidation.
 *
 * @example
 * ```ts
 * import { OntologyInferenceSignatureRole } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const role: OntologyInferenceSignatureRole = "predicate"
 *
 * console.log(role)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const OntologyInferenceSignatureRole = LiteralKit(["subject", "predicate", "object"]).pipe(
  $I.annoteSchema("OntologyInferenceSignatureRole", {
    description: "Changed signature role used by inference invalidation.",
  })
);

/**
 * Type for {@link OntologyInferenceSignatureRole}.
 *
 * @example
 * ```ts
 * import { OntologyInferenceSignatureRole } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const role: OntologyInferenceSignatureRole = "object"
 *
 * console.log(role)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export type OntologyInferenceSignatureRole = typeof OntologyInferenceSignatureRole.Type;

/**
 * Signature touched by the session change log since the last inference pass.
 *
 * @example
 * ```ts
 * import { OntologyInferenceChangedSignature } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const signature = OntologyInferenceChangedSignature.make({
 *   role: "predicate",
 *   value: "http://www.w3.org/2000/01/rdf-schema#subClassOf"
 * })
 *
 * console.log(signature.role)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class OntologyInferenceChangedSignature extends S.Class<OntologyInferenceChangedSignature>(
  $I`OntologyInferenceChangedSignature`
)(
  {
    role: OntologyInferenceSignatureRole,
    value: S.String,
  },
  $I.annote("OntologyInferenceChangedSignature", {
    description: "Signature touched by the session change log since the last inference pass.",
  })
) {}

/**
 * Result for one structural inference module.
 *
 * @example
 * ```ts
 * import { OntologyInferenceModuleResult } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const result = OntologyInferenceModuleResult.make({
 *   module: "closure",
 *   mode: "full",
 *   inferredQuads: []
 * })
 *
 * console.log(result.inferredQuads.length)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class OntologyInferenceModuleResult extends S.Class<OntologyInferenceModuleResult>(
  $I`OntologyInferenceModuleResult`
)(
  {
    module: OntologyInferenceModule,
    mode: OntologyInferenceRecomputeMode,
    inferredQuads: S.Array(Quad),
  },
  $I.annote("OntologyInferenceModuleResult", {
    description: "Result for one structural inference module.",
  })
) {}

/**
 * Structural disjointness violation derived from asserted plus inferred types.
 *
 * @example
 * ```ts
 * import { OntologyDisjointnessViolation } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const violation = OntologyDisjointnessViolation.make({
 *   individualIri: "https://example.test/item",
 *   leftClassIri: "https://example.test/A",
 *   rightClassIri: "https://example.test/B"
 * })
 *
 * console.log(violation.individualIri)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class OntologyDisjointnessViolation extends S.Class<OntologyDisjointnessViolation>(
  $I`OntologyDisjointnessViolation`
)(
  {
    individualIri: S.String,
    leftClassIri: S.String,
    rightClassIri: S.String,
  },
  $I.annote("OntologyDisjointnessViolation", {
    description: "Structural disjointness violation derived from asserted plus inferred types.",
  })
) {}

/**
 * Complete structural inference result for an ontology session.
 *
 * @example
 * ```ts
 * import { OntologyInferenceResult } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const result = OntologyInferenceResult.make({
 *   processedChangeCount: 0,
 *   driftCap: NonNegativeInt.make(64),
 *   drifted: false,
 *   fullRecompute: true,
 *   changedSignatures: [],
 *   modules: [],
 *   disjointnessViolations: [],
 *   inferredDataset: makeDataset([])
 * })
 *
 * console.log(result.inferredDataset.quads.length)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class OntologyInferenceResult extends S.Class<OntologyInferenceResult>($I`OntologyInferenceResult`)(
  {
    processedChangeCount: S.Int,
    driftCap: NonNegativeInt,
    drifted: S.Boolean,
    fullRecompute: S.Boolean,
    changedSignatures: S.Array(OntologyInferenceChangedSignature),
    modules: S.Array(OntologyInferenceModuleResult),
    disjointnessViolations: S.Array(OntologyDisjointnessViolation),
    inferredDataset: Dataset,
  },
  $I.annote("OntologyInferenceResult", {
    description: "Complete structural inference result for an ontology session.",
  })
) {}

/**
 * Input for structural inference over an ontology session.
 *
 * @example
 * ```ts
 * import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { InferOntologySessionInput } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const input = InferOntologySessionInput.make({
 *   session: createSession(
 *     CreateSessionInput.make({
 *       id: S.decodeUnknownSync(SessionId)("session-1"),
 *       baseDataset: makeDataset([])
 *     })
 *   )
 * })
 *
 * console.log(input.driftCap)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class InferOntologySessionInput extends S.Class<InferOntologySessionInput>($I`InferOntologySessionInput`)(
  {
    session: Session,
    previous: S.OptionFromOptionalKey(OntologyInferenceResult).pipe(SchemaUtils.withNoneDefault),
    driftCap: S.optionalKey(NonNegativeInt).pipe(S.withConstructorDefault(Effect.succeed(NonNegativeInt.make(64)))),
  },
  $I.annote("InferOntologySessionInput", {
    description: "Input for structural inference over an ontology session.",
  })
) {}

/**
 * Reasoner service shape.
 *
 * @example
 * ```ts
 * import type { OntologyReasonerShape } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const acceptReasoner = (value: OntologyReasonerShape) => value
 *
 * console.log(acceptReasoner)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface OntologyReasonerShape {
  readonly infer: (input: InferOntologySessionInput) => Effect.Effect<OntologyInferenceResult>;
}

type GraphEdges = MutableHashMap.MutableHashMap<string, ReadonlyArray<string>>;

const emptyStrings: () => ReadonlyArray<string> = A.empty;
const noneString: () => O.Option<string> = O.none;

const subjectKey = (subject: Subject): string =>
  Subject.match(subject, {
    NamedNode: (node) => node.value,
    BlankNode: (node) => serializeTerm(node),
  });

const objectKey = (object: ObjectTerm): O.Option<string> =>
  ObjectTerm.match(object, {
    NamedNode: (node) => O.some(node.value),
    BlankNode: (node) => O.some(serializeTerm(node)),
    Literal: noneString,
  });

const subjectTerm = (key: string): Subject =>
  pipe(key, Str.startsWith("_:"))
    ? BlankNode.make({ termType: "BlankNode", value: pipe(key, Str.slice(2)) })
    : makeNamedNode(key);

const iriObject = (iri: string): NamedNode => makeNamedNode(iri);

const tripleKey = (quad: Quad): string =>
  `${serializeTerm(quad.subject)}\n${quad.predicate.value}\n${serializeTerm(quad.object)}`;

const appendUnique = <Value>(values: ReadonlyArray<Value>, value: Value): ReadonlyArray<Value> =>
  pipe(values, A.contains(value)) ? values : pipe(values, A.append(value));

const upsertEdge = (edges: GraphEdges, source: string, target: string): void => {
  MutableHashMap.set(
    edges,
    source,
    appendUnique(pipe(MutableHashMap.get(edges, source), O.getOrElse(emptyStrings)), target)
  );
};

const addQuadUnique = (quads: ReadonlyArray<Quad>, quad: Quad): ReadonlyArray<Quad> =>
  pipe(
    quads,
    A.some((existing) => tripleKey(existing) === tripleKey(quad))
  )
    ? quads
    : pipe(quads, A.append(quad));

const moduleResult = (
  module: OntologyInferenceModule,
  mode: OntologyInferenceRecomputeMode,
  inferredQuads: ReadonlyArray<Quad>
): OntologyInferenceModuleResult =>
  OntologyInferenceModuleResult.make({
    module,
    mode,
    inferredQuads: A.fromIterable(inferredQuads),
  });

const previousModule = (
  previous: O.Option<OntologyInferenceResult>,
  module: OntologyInferenceModule
): O.Option<OntologyInferenceModuleResult> =>
  pipe(
    previous,
    O.flatMap((result) =>
      pipe(
        result.modules,
        A.findFirst((entry) => entry.module === module)
      )
    )
  );

const changedOperationWindow = (input: InferOntologySessionInput): ReadonlyArray<Session["changeLog"][number]> =>
  pipe(
    input.previous,
    O.match({
      onNone: () => input.session.changeLog,
      onSome: (previous) =>
        input.session.changeLog.length < previous.processedChangeCount
          ? input.session.changeLog
          : A.drop(input.session.changeLog, previous.processedChangeCount),
    })
  );

const changedSignaturesFor: (
  operations: ReadonlyArray<Session["changeLog"][number]>
) => ReadonlyArray<OntologyInferenceChangedSignature> = flow(
  A.flatMap((operation: Session["changeLog"][number]) => [
    OntologyInferenceChangedSignature.make({
      role: "subject",
      value: serializeTerm(operation.quad.subject),
    }),
    OntologyInferenceChangedSignature.make({
      role: "predicate",
      value: operation.quad.predicate.value,
    }),
    OntologyInferenceChangedSignature.make({
      role: "object",
      value: serializeTerm(operation.quad.object),
    }),
  ]),
  A.dedupeWith((left, right) => left.role === right.role && left.value === right.value),
  A.sortWith((signature) => `${signature.role}:${signature.value}`, Order.String)
);

const signatureHasPredicate = (
  signatures: ReadonlyArray<OntologyInferenceChangedSignature>,
  predicate: NamedNode
): boolean =>
  pipe(
    signatures,
    A.some((signature) => signature.role === "predicate" && signature.value === predicate.value)
  );

const closureAffected = (signatures: ReadonlyArray<OntologyInferenceChangedSignature>): boolean =>
  signatureHasPredicate(signatures, RDFS_SUB_CLASS_OF) || signatureHasPredicate(signatures, RDFS_SUB_PROPERTY_OF);

const domainRangeAffected = (signatures: ReadonlyArray<OntologyInferenceChangedSignature>): boolean =>
  signatureHasPredicate(signatures, RDFS_DOMAIN) ||
  signatureHasPredicate(signatures, RDFS_RANGE) ||
  pipe(
    signatures,
    A.some((signature) => signature.role === "predicate")
  );

const disjointnessAffected = (signatures: ReadonlyArray<OntologyInferenceChangedSignature>): boolean =>
  signatureHasPredicate(signatures, OWL_DISJOINT_WITH) || signatureHasPredicate(signatures, RDF_TYPE);

const assertedAndOntologyQuads = (session: Session): ReadonlyArray<Quad> => {
  const partitions = deriveSessionGraphPartitions(session);
  return pipe(partitions.asserted.quads, A.appendAll(partitions.ontologies.quads));
};

const existingTripleKeys: (quads: ReadonlyArray<Quad>) => ReadonlyArray<string> = flow(
  A.map(tripleKey),
  A.dedupe,
  A.sort(Order.String)
);

const hasExistingTriple = (keys: ReadonlyArray<string>, quad: Quad): boolean => pipe(keys, A.contains(tripleKey(quad)));

const inferredQuad = (subject: Subject, predicate: NamedNode, object: ObjectTerm): Quad =>
  makeQuad(subject, predicate, {
    object,
    graph: INFERRED_GRAPH,
  });

const collectEdges = (quads: ReadonlyArray<Quad>, predicate: NamedNode): GraphEdges => {
  const edges = MutableHashMap.empty<string, ReadonlyArray<string>>();
  for (const quad of quads) {
    if (quad.predicate.value === predicate.value) {
      pipe(
        objectKey(quad.object),
        O.match({
          onNone: () => undefined,
          onSome: (target) => upsertEdge(edges, subjectKey(quad.subject), target),
        })
      );
    }
  }
  return edges;
};

const ancestorsFor = (edges: GraphEdges, source: string): ReadonlyArray<string> => {
  const visit = (frontier: ReadonlyArray<string>, visited: ReadonlyArray<string>): ReadonlyArray<string> =>
    pipe(
      frontier,
      A.match({
        onEmpty: () => visited,
        onNonEmpty: ([head, ...tail]) =>
          pipe(visited, A.contains(head))
            ? visit(tail, visited)
            : visit(
                pipe(tail, A.appendAll(pipe(MutableHashMap.get(edges, head), O.getOrElse(emptyStrings)))),
                pipe(visited, A.append(head))
              ),
      })
    );

  return pipe(
    MutableHashMap.get(edges, source),
    O.map((parents) => visit(parents, [])),
    O.getOrElse(emptyStrings)
  );
};

const closureQuads = (quads: ReadonlyArray<Quad>, keys: ReadonlyArray<string>): ReadonlyArray<Quad> => {
  const subclassEdges = collectEdges(quads, RDFS_SUB_CLASS_OF);
  const subpropertyEdges = collectEdges(quads, RDFS_SUB_PROPERTY_OF);
  let inferred: ReadonlyArray<Quad> = [];

  for (const [child, parents] of subclassEdges) {
    for (const ancestor of pipe(
      parents,
      A.flatMap((parent) => ancestorsFor(subclassEdges, parent))
    )) {
      const quad = inferredQuad(subjectTerm(child), RDFS_SUB_CLASS_OF, iriObject(ancestor));
      inferred = hasExistingTriple(keys, quad) ? inferred : addQuadUnique(inferred, quad);
    }
  }

  for (const [child, parents] of subpropertyEdges) {
    for (const ancestor of pipe(
      parents,
      A.flatMap((parent) => ancestorsFor(subpropertyEdges, parent))
    )) {
      const quad = inferredQuad(subjectTerm(child), RDFS_SUB_PROPERTY_OF, iriObject(ancestor));
      inferred = hasExistingTriple(keys, quad) ? inferred : addQuadUnique(inferred, quad);
    }
  }

  for (const quad of quads) {
    for (const superProperty of ancestorsFor(subpropertyEdges, quad.predicate.value)) {
      const propagated = inferredQuad(quad.subject, makeNamedNode(superProperty), quad.object);
      inferred = hasExistingTriple(keys, propagated) ? inferred : addQuadUnique(inferred, propagated);
    }
  }

  const typeQuads = pipe(
    quads,
    A.filter((quad) => quad.predicate.value === RDF_TYPE.value)
  );
  for (const quad of typeQuads) {
    pipe(
      objectKey(quad.object),
      O.match({
        onNone: () => undefined,
        onSome: (classIri) => {
          for (const ancestor of ancestorsFor(subclassEdges, classIri)) {
            const propagated = inferredQuad(quad.subject, RDF_TYPE, iriObject(ancestor));
            inferred = hasExistingTriple(keys, propagated) ? inferred : addQuadUnique(inferred, propagated);
          }
        },
      })
    );
  }

  return inferred;
};

const propertyClassMap = (quads: ReadonlyArray<Quad>, predicate: NamedNode): GraphEdges => {
  const edges = MutableHashMap.empty<string, ReadonlyArray<string>>();
  for (const quad of quads) {
    if (quad.predicate.value === predicate.value) {
      pipe(
        objectKey(quad.object),
        O.match({
          onNone: () => undefined,
          onSome: (classIri) => upsertEdge(edges, quad.subject.value, classIri),
        })
      );
    }
  }
  return edges;
};

const classConstraintsFor = (
  map: GraphEdges,
  propertyClosure: GraphEdges,
  propertyIri: string
): ReadonlyArray<string> =>
  pipe(
    [propertyIri, ...ancestorsFor(propertyClosure, propertyIri)],
    A.flatMap((iri) => pipe(MutableHashMap.get(map, iri), O.getOrElse(emptyStrings))),
    A.dedupe,
    A.sort(Order.String)
  );

const domainRangeQuads = (quads: ReadonlyArray<Quad>, keys: ReadonlyArray<string>): ReadonlyArray<Quad> => {
  const propertyClosure = collectEdges(quads, RDFS_SUB_PROPERTY_OF);
  const domains = propertyClassMap(quads, RDFS_DOMAIN);
  const ranges = propertyClassMap(quads, RDFS_RANGE);
  let inferred: ReadonlyArray<Quad> = [];

  for (const quad of quads) {
    for (const classIri of classConstraintsFor(domains, propertyClosure, quad.predicate.value)) {
      const typed = inferredQuad(quad.subject, RDF_TYPE, iriObject(classIri));
      inferred = hasExistingTriple(keys, typed) ? inferred : addQuadUnique(inferred, typed);
    }

    pipe(
      objectKey(quad.object),
      O.match({
        onNone: () => undefined,
        onSome: (objectIri) => {
          for (const classIri of classConstraintsFor(ranges, propertyClosure, quad.predicate.value)) {
            const typed = inferredQuad(subjectTerm(objectIri), RDF_TYPE, iriObject(classIri));
            inferred = hasExistingTriple(keys, typed) ? inferred : addQuadUnique(inferred, typed);
          }
        },
      })
    );
  }

  return inferred;
};

const typeMap = (quads: ReadonlyArray<Quad>): GraphEdges => {
  const map = MutableHashMap.empty<string, ReadonlyArray<string>>();
  for (const quad of quads) {
    if (quad.predicate.value === RDF_TYPE.value) {
      pipe(
        objectKey(quad.object),
        O.match({
          onNone: () => undefined,
          onSome: (classIri) => upsertEdge(map, subjectKey(quad.subject), classIri),
        })
      );
    }
  }
  return map;
};

const disjointnessViolations = (
  quads: ReadonlyArray<Quad>,
  inferred: ReadonlyArray<Quad>
): ReadonlyArray<OntologyDisjointnessViolation> => {
  const disjoint = collectEdges(quads, OWL_DISJOINT_WITH);
  const types = typeMap(pipe(quads, A.appendAll(inferred)));
  let violations: ReadonlyArray<OntologyDisjointnessViolation> = [];

  for (const [individualIri, classIris] of types) {
    for (const leftClassIri of classIris) {
      for (const rightClassIri of pipe(MutableHashMap.get(disjoint, leftClassIri), O.getOrElse(emptyStrings))) {
        if (pipe(classIris, A.contains(rightClassIri))) {
          const ordered = pipe([leftClassIri, rightClassIri], A.sort(Order.String));
          violations = pipe(
            violations,
            A.append(
              OntologyDisjointnessViolation.make({
                individualIri,
                leftClassIri: ordered[0] ?? leftClassIri,
                rightClassIri: ordered[1] ?? rightClassIri,
              })
            )
          );
        }
      }
    }
  }

  return pipe(
    violations,
    A.dedupeWith(
      (left, right) =>
        left.individualIri === right.individualIri &&
        left.leftClassIri === right.leftClassIri &&
        left.rightClassIri === right.rightClassIri
    ),
    A.sortWith(
      (violation) => `${violation.individualIri}:${violation.leftClassIri}:${violation.rightClassIri}`,
      Order.String
    )
  );
};

const recomputeMode = (
  fullRecompute: boolean,
  affected: boolean,
  previous: O.Option<OntologyInferenceModuleResult>
): OntologyInferenceRecomputeMode => {
  if (fullRecompute) return "full";
  if (O.isSome(previous) && !affected) return "reused";
  return "incremental";
};

const reusedModuleQuads = (
  module: O.Option<OntologyInferenceModuleResult>,
  mode: OntologyInferenceRecomputeMode
): O.Option<ReadonlyArray<Quad>> =>
  pipe(
    module,
    O.filter(() => mode === "reused"),
    O.map((result) => result.inferredQuads)
  );

const inferredTypeKeys: (quads: ReadonlyArray<Quad>) => ReadonlyArray<string> = flow(
  A.filter((quad: Quad) => quad.predicate.value === RDF_TYPE.value),
  A.map(tripleKey),
  A.dedupe,
  A.sort(Order.String)
);

const sameTypeKeys = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length &&
  pipe(
    left,
    A.every((key, index) => right[index] === key)
  );

const moduleTypeKeys: (module: O.Option<OntologyInferenceModuleResult>) => ReadonlyArray<string> = flow(
  O.map((result: OntologyInferenceModuleResult) => inferredTypeKeys(result.inferredQuads)),
  O.getOrElse(A.empty)
);

const typeBearingInferenceChanged = (
  previousClosure: O.Option<OntologyInferenceModuleResult>,
  closure: ReadonlyArray<Quad>,
  previousDomainRange: O.Option<OntologyInferenceModuleResult>,
  domainRange: ReadonlyArray<Quad>
): boolean => {
  const previousKeys = pipe(
    moduleTypeKeys(previousClosure),
    A.appendAll(moduleTypeKeys(previousDomainRange)),
    A.dedupe,
    A.sort(Order.String)
  );
  const nextKeys = pipe(
    inferredTypeKeys(closure),
    A.appendAll(inferredTypeKeys(domainRange)),
    A.dedupe,
    A.sort(Order.String)
  );
  return !sameTypeKeys(previousKeys, nextKeys);
};

const inferOntologySession = Effect.fn("Ontology.Reasoner.infer")(function* (input: InferOntologySessionInput) {
  const changedOperations = changedOperationWindow(input);
  const changedSignatures = changedSignaturesFor(changedOperations);
  const previous = input.previous;
  const driftCap = input.driftCap ?? NonNegativeInt.make(64);
  const historyRewound = pipe(
    previous,
    O.exists((result) => input.session.changeLog.length < result.processedChangeCount)
  );
  const drifted = historyRewound || changedOperations.length > driftCap;
  const fullRecompute = O.isNone(previous) || drifted;
  const quads = assertedAndOntologyQuads(input.session);
  const keys = existingTripleKeys(quads);
  const previousClosure = previousModule(previous, "closure");
  const previousDomainRange = previousModule(previous, "domainRange");
  const closureMode = recomputeMode(fullRecompute, closureAffected(changedSignatures), previousClosure);
  const domainRangeMode = recomputeMode(fullRecompute, domainRangeAffected(changedSignatures), previousDomainRange);
  const closure = pipe(
    reusedModuleQuads(previousClosure, closureMode),
    O.getOrElse(() => closureQuads(quads, keys))
  );
  const domainRange = pipe(
    reusedModuleQuads(previousDomainRange, domainRangeMode),
    O.getOrElse(() =>
      domainRangeQuads(pipe(quads, A.appendAll(closure)), pipe(keys, A.appendAll(A.map(closure, tripleKey))))
    )
  );
  const disjointnessMode = recomputeMode(
    fullRecompute,
    disjointnessAffected(changedSignatures) ||
      typeBearingInferenceChanged(previousClosure, closure, previousDomainRange, domainRange),
    previousModule(previous, "disjointness")
  );
  const violations =
    disjointnessMode === "reused"
      ? pipe(
          previous,
          O.map((result) => result.disjointnessViolations),
          O.getOrElse(A.empty)
        )
      : disjointnessViolations(quads, pipe(closure, A.appendAll(domainRange)));
  const disjointnessModule = moduleResult("disjointness", disjointnessMode, []);
  const modules = [
    moduleResult("closure", closureMode, closure),
    moduleResult("domainRange", domainRangeMode, domainRange),
    disjointnessModule,
  ];
  const inferredQuads = pipe(
    modules,
    A.flatMap((module) => module.inferredQuads),
    A.dedupeWith((left, right) => serializeQuad(left) === serializeQuad(right)),
    A.sortWith(serializeQuad, Order.String)
  );

  return OntologyInferenceResult.make({
    processedChangeCount: input.session.changeLog.length,
    driftCap,
    drifted,
    fullRecompute,
    changedSignatures,
    modules,
    disjointnessViolations: violations,
    inferredDataset: makeDataset(inferredQuads),
  });
});

/**
 * Build a session partition set with inferred quads in the derived inferred partition.
 *
 * @example
 * ```ts
 * import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { inferredSessionGraphPartitions, OntologyInferenceResult } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const session = createSession(
 *   CreateSessionInput.make({
 *     id: S.decodeUnknownSync(SessionId)("session-1"),
 *     baseDataset: makeDataset([])
 *   })
 * )
 * const result = OntologyInferenceResult.make({
 *   processedChangeCount: 0,
 *   driftCap: NonNegativeInt.make(64),
 *   drifted: false,
 *   fullRecompute: true,
 *   changedSignatures: [],
 *   modules: [],
 *   disjointnessViolations: [],
 *   inferredDataset: makeDataset([])
 * })
 *
 * console.log(inferredSessionGraphPartitions(session, result).inferred.quads.length)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const inferredSessionGraphPartitions: {
  (inference: OntologyInferenceResult): (session: Session) => SessionGraphPartitions;
  (session: Session, inference: OntologyInferenceResult): SessionGraphPartitions;
} = dual(
  2,
  (session: Session, inference: OntologyInferenceResult): SessionGraphPartitions =>
    SessionGraphPartitions.make({
      ...deriveSessionGraphPartitions(session),
      inferred: inference.inferredDataset,
    })
);

/**
 * Reasoner service tag.
 *
 * @example
 * ```ts
 * import { OntologyReasoner } from "@beep/ontology-use-cases/aggregates/Session"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const reasoner = yield* OntologyReasoner
 *   return reasoner
 * })
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OntologyReasoner extends Context.Service<OntologyReasoner, OntologyReasonerShape>()(
  $I`OntologyReasoner`
) {}

/**
 * Live domain-native structural reasoner.
 *
 * @example
 * ```ts
 * import { OntologyReasonerLive } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(OntologyReasonerLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const OntologyReasonerLive = Layer.succeed(
  OntologyReasoner,
  OntologyReasoner.of({
    infer: inferOntologySession,
  })
);
