/**
 * SHACL validation, verified repair, and provenance export use cases.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyUseCasesId } from "@beep/identity/packages";
import {
  applyChangeOperationsWithDelta,
  ChangeOperation,
  deriveSessionGraphPartitions,
  Session,
} from "@beep/ontology-domain/aggregates/Session";
import {
  makeDataset,
  makeLiteral,
  makeNamedNode,
  makeQuad,
  NamedNode,
  ObjectTerm,
  PrefixMap,
  serializeQuad,
  serializeTerm,
} from "@beep/rdf/Rdf";
import { DCTERMS_NAMESPACE } from "@beep/rdf/Vocab/Dcterms";
import {
  PROV_ACTIVITY,
  PROV_AGENT,
  PROV_ENTITY,
  PROV_NAMESPACE,
  PROV_USED,
  PROV_WAS_GENERATED_BY,
} from "@beep/rdf/Vocab/Prov";
import { RDF_NAMESPACE, RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_INTEGER, XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import {
  ShaclNodeShape,
  ShaclPropertyShape,
  ShaclValidationRequest,
  ShaclValidationResult,
  ShaclValidationService,
} from "@beep/semantic-web/services/shacl-validation";
import { A, O } from "@beep/utils";
import { Context, Effect, Layer, pipe } from "effect";
import * as S from "effect/Schema";
import {
  OntologyFilePath,
  OntologyFileStore,
  SerializeTurtleRequest,
  TurtleCodec,
  TurtleDocumentText,
  WriteOntologyFileRequest,
} from "./Session.ports.ts";
import { inferredSessionGraphPartitions, OntologyInferenceResult } from "./Session.reasoner.ts";
import type { SessionGraphPartitions } from "@beep/ontology-domain/aggregates/Session";
import type { Dataset, Quad, Subject } from "@beep/rdf/Rdf";
import type { ShaclValidationError, ShaclValidationViolation } from "@beep/semantic-web/services/shacl-validation";
import type { OntologyFileStoreError, TurtleCodecError } from "./Session.ports.ts";

const $I = $OntologyUseCasesId.create("aggregates/Session/Session.validation");

const SHACL_NAMESPACE = "http://www.w3.org/ns/shacl#" as const;
const VOID_NAMESPACE = "http://rdfs.org/ns/void#" as const;
const DCAT_NAMESPACE = "http://www.w3.org/ns/dcat#" as const;
const SH_NODE_SHAPE = makeNamedNode(`${SHACL_NAMESPACE}NodeShape`);
const SH_PROPERTY = makeNamedNode(`${SHACL_NAMESPACE}property`);
const SH_PATH = makeNamedNode(`${SHACL_NAMESPACE}path`);
const SH_TARGET_CLASS = makeNamedNode(`${SHACL_NAMESPACE}targetClass`);
const SH_TARGET_NODE = makeNamedNode(`${SHACL_NAMESPACE}targetNode`);
const SH_MIN_COUNT = makeNamedNode(`${SHACL_NAMESPACE}minCount`);
const SH_MAX_COUNT = makeNamedNode(`${SHACL_NAMESPACE}maxCount`);
const SH_DATATYPE = makeNamedNode(`${SHACL_NAMESPACE}datatype`);
const SH_CLASS = makeNamedNode(`${SHACL_NAMESPACE}class`);
const SH_HAS_VALUE = makeNamedNode(`${SHACL_NAMESPACE}hasValue`);
const SH_MIN_COUNT_COMPONENT = makeNamedNode(`${SHACL_NAMESPACE}MinCountConstraintComponent`);
const SH_DATATYPE_COMPONENT = makeNamedNode(`${SHACL_NAMESPACE}DatatypeConstraintComponent`);
const SH_CLASS_COMPONENT = makeNamedNode(`${SHACL_NAMESPACE}ClassConstraintComponent`);
const SH_HAS_VALUE_COMPONENT = makeNamedNode(`${SHACL_NAMESPACE}HasValueConstraintComponent`);
const VOID_DATASET = makeNamedNode(`${VOID_NAMESPACE}Dataset`);
const VOID_TRIPLES = makeNamedNode(`${VOID_NAMESPACE}triples`);
const DCAT_DATASET = makeNamedNode(`${DCAT_NAMESPACE}Dataset`);
const DCAT_DISTRIBUTION = makeNamedNode(`${DCAT_NAMESPACE}distribution`);

const dcterms = (name: string): NamedNode => makeNamedNode(`${DCTERMS_NAMESPACE}${name}`);
const prov = (name: string): NamedNode => makeNamedNode(`${PROV_NAMESPACE}${name}`);
const dcat = (name: string): NamedNode => makeNamedNode(`${DCAT_NAMESPACE}${name}`);

/**
 * Verified ontology repair proposal generated from a SHACL violation.
 *
 * **Example** (Make verified repair proposal)
 *
 * ```ts
 * import { ChangeOperation, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { OntologyRepairProposal } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const proposal = OntologyRepairProposal.make({
 *   id: "repair:0",
 *   violationIndex: NonNegativeInt.make(0),
 *   focusNode: "https://example.test/alice",
 *   path: makeNamedNode("https://schema.org/name"),
 *   message: "Add the missing value.",
 *   verified: true,
 *   operations: [
 *     ChangeOperation.make({
 *       kind: "addQuad",
 *       partition: "asserted",
 *       quad: makeQuad(
 *         makeNamedNode("https://example.test/alice"),
 *         makeNamedNode("https://schema.org/name"),
 *         makeNamedNode("https://example.test/Alice")
 *       )
 *     })
 *   ]
 * })
 *
 * console.log(proposal.verified)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OntologyRepairProposal extends S.Class<OntologyRepairProposal>($I`OntologyRepairProposal`)(
  {
    id: S.NonEmptyString,
    violationIndex: NonNegativeInt,
    focusNode: S.NonEmptyString,
    path: NamedNode,
    message: S.String,
    operations: S.Array(ChangeOperation),
    verified: S.Boolean,
  },
  $I.annote("OntologyRepairProposal", {
    description: "Verified ontology repair proposal generated from a SHACL violation.",
  })
) {}

/**
 * Validation request for an ontology session.
 *
 * **Example** (Make validation input with session)
 *
 * ```ts
 * import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { RunOntologyValidationInput } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const input = RunOntologyValidationInput.make({
 *   session: createSession(
 *     CreateSessionInput.make({
 *       id: S.decodeUnknownSync(SessionId)("session-1"),
 *       baseDataset: makeDataset([])
 *     })
 *   )
 * })
 *
 * console.log(input.maxResults)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunOntologyValidationInput extends S.Class<RunOntologyValidationInput>($I`RunOntologyValidationInput`)(
  {
    session: Session,
    inference: S.OptionFromOptionalKey(OntologyInferenceResult).pipe(SchemaUtils.withNoneDefault),
    maxResults: NonNegativeInt.pipe(
      S.withConstructorDefault(Effect.succeed(100)),
      S.withDecodingDefaultKey(Effect.succeed(100))
    ),
  },
  $I.annote("RunOntologyValidationInput", {
    description: "Validation request for an ontology session.",
  })
) {}

/**
 * Validation result with verified repair proposals.
 *
 * **Example** (Make conforming validation result)
 *
 * ```ts
 * import { RunOntologyValidationResult } from "@beep/ontology-use-cases/aggregates/Session"
 * import { ShaclValidationResult } from "@beep/semantic-web/services/shacl-validation"
 *
 * const result = RunOntologyValidationResult.make({
 *   validation: ShaclValidationResult.make({ conforms: true, violations: [], truncated: false }),
 *   repairs: [],
 *   shapeCount: 0,
 *   dataQuadCount: 0,
 *   inferredQuadCount: 0
 * })
 *
 * console.log(result.validation.conforms)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunOntologyValidationResult extends S.Class<RunOntologyValidationResult>($I`RunOntologyValidationResult`)(
  {
    validation: ShaclValidationResult,
    repairs: S.Array(OntologyRepairProposal),
    shapeCount: S.Int,
    dataQuadCount: S.Int,
    inferredQuadCount: S.Int,
  },
  $I.annote("RunOntologyValidationResult", {
    description: "Validation result with verified repair proposals.",
  })
) {}

/**
 * Provenance and dataset-description export command.
 *
 * **Example** (Make provenance export command)
 *
 * ```ts
 * import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { ExportOntologyProvenanceCommand, OntologyFilePath } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const command = ExportOntologyProvenanceCommand.make({
 *   session: createSession(
 *     CreateSessionInput.make({
 *       id: S.decodeUnknownSync(SessionId)("session-1"),
 *       baseDataset: makeDataset([])
 *     })
 *   ),
 *   provPath: S.decodeUnknownSync(OntologyFilePath)("tmp/session.prov.ttl"),
 *   datasetPath: S.decodeUnknownSync(OntologyFilePath)("tmp/session.dataset.ttl")
 * })
 *
 * console.log(command.provPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExportOntologyProvenanceCommand extends S.Class<ExportOntologyProvenanceCommand>(
  $I`ExportOntologyProvenanceCommand`
)(
  {
    session: Session,
    provPath: OntologyFilePath,
    datasetPath: OntologyFilePath,
  },
  $I.annote("ExportOntologyProvenanceCommand", {
    description: "Provenance and dataset-description export command.",
  })
) {}

/**
 * Provenance and dataset-description export result.
 *
 * **Example** (Make provenance export result)
 *
 * ```ts
 * import { ExportOntologyProvenanceResult, OntologyFilePath } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const result = ExportOntologyProvenanceResult.make({
 *   provPath: S.decodeUnknownSync(OntologyFilePath)("tmp/session.prov.ttl"),
 *   datasetPath: S.decodeUnknownSync(OntologyFilePath)("tmp/session.dataset.ttl"),
 *   provSource: "@prefix prov: <http://www.w3.org/ns/prov#> .",
 *   datasetSource: "@prefix void: <http://rdfs.org/ns/void#> ."
 * })
 *
 * console.log(result.datasetPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExportOntologyProvenanceResult extends S.Class<ExportOntologyProvenanceResult>(
  $I`ExportOntologyProvenanceResult`
)(
  {
    provPath: OntologyFilePath,
    datasetPath: OntologyFilePath,
    provSource: TurtleDocumentText,
    datasetSource: TurtleDocumentText,
  },
  $I.annote("ExportOntologyProvenanceResult", {
    description: "Provenance and dataset-description export result.",
  })
) {}

/**
 * Ontology validation failure.
 *
 * **Example** (Make SHACL validation error)
 *
 * ```ts
 * import { OntologyValidationError } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const error = OntologyValidationError.make({
 *   reason: "shaclFailed",
 *   message: "SHACL validation failed."
 * })
 *
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OntologyValidationError extends S.TaggedError<OntologyValidationError>($I`OntologyValidationError`)(
  "OntologyValidationError",
  {
    reason: LiteralKit(["shaclFailed", "repairVerificationFailed", "actorIdentityMissing"]),
    message: S.String,
  },
  $I.annoteError<OntologyValidationError>("OntologyValidationError", {
    description: "Ontology validation failure.",
  })
) {}

/**
 * Ontology validation runner service shape.
 *
 * **Example** (Stub validation runner shape)
 *
 * ```ts
 * import type { OntologyValidationRunnerShape } from "@beep/ontology-use-cases/aggregates/Session"
 * import { Effect } from "effect"
 *
 * const runner: OntologyValidationRunnerShape = {
 *   run: () => Effect.die(new Error("example validation runner")),
 *   exportProvenance: () => Effect.die(new Error("example provenance exporter"))
 * }
 *
 * console.log(runner.run)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface OntologyValidationRunnerShape {
  readonly exportProvenance: (
    command: ExportOntologyProvenanceCommand
  ) => Effect.Effect<
    ExportOntologyProvenanceResult,
    OntologyFileStoreError | OntologyValidationError | TurtleCodecError
  >;
  readonly run: (
    input: RunOntologyValidationInput
  ) => Effect.Effect<RunOntologyValidationResult, OntologyValidationError>;
}

type ShapeRepairTarget = {
  readonly shape: ShaclNodeShape;
  readonly property: ShaclPropertyShape;
};

const sameNamedNode = (left: NamedNode, right: NamedNode): boolean => left.value === right.value;
const sameViolationDetails = (left: ShaclValidationViolation, right: ShaclValidationViolation): boolean =>
  left.message === right.message && left.severity === right.severity;
const hasPredicate = (quad: Quad, predicate: NamedNode): boolean => quad.predicate.value === predicate.value;

const objectNamedNode = (quad: Quad): O.Option<NamedNode> =>
  quad.object.termType === "NamedNode" ? O.some(quad.object) : O.none();

const objectSubject = (quad: Quad): O.Option<Subject> =>
  quad.object.termType === "NamedNode" || quad.object.termType === "BlankNode" ? O.some(quad.object) : O.none();

const objectInteger = (quad: Quad): O.Option<NonNegativeInt> =>
  quad.object.termType === "Literal" ? O.some(NonNegativeInt.make(Number.parseInt(quad.object.value, 10))) : O.none();

const quadsForSubject = (dataset: Dataset, subject: Subject): ReadonlyArray<Quad> =>
  pipe(
    dataset.quads,
    A.filter((quad) => serializeTerm(quad.subject) === serializeTerm(subject))
  );

const firstObjectNamedNode = (dataset: Dataset, subject: Subject, predicate: NamedNode): O.Option<NamedNode> =>
  pipe(
    quadsForSubject(dataset, subject),
    A.findFirst((quad) => hasPredicate(quad, predicate)),
    O.flatMap(objectNamedNode)
  );

const firstObjectTerm = (dataset: Dataset, subject: Subject, predicate: NamedNode): O.Option<ObjectTerm> =>
  pipe(
    quadsForSubject(dataset, subject),
    A.findFirst((quad) => hasPredicate(quad, predicate)),
    O.map((quad) => quad.object)
  );

const firstObjectInteger = (dataset: Dataset, subject: Subject, predicate: NamedNode): O.Option<NonNegativeInt> =>
  pipe(
    quadsForSubject(dataset, subject),
    A.findFirst((quad) => hasPredicate(quad, predicate)),
    O.flatMap(objectInteger)
  );

const nodeShapeSubjects = (dataset: Dataset): ReadonlyArray<Subject> =>
  pipe(
    dataset.quads,
    A.filter((quad) => hasPredicate(quad, RDF_TYPE)),
    A.filter((quad) => quad.object.termType === "NamedNode" && sameNamedNode(quad.object, SH_NODE_SHAPE)),
    A.map((quad) => quad.subject)
  );

const propertyShapesFor = (dataset: Dataset, shapeSubject: Subject): ReadonlyArray<ShaclPropertyShape> =>
  pipe(
    quadsForSubject(dataset, shapeSubject),
    A.filter((quad) => hasPredicate(quad, SH_PROPERTY)),
    A.map((quad) =>
      pipe(
        objectSubject(quad),
        O.flatMap((propertySubject) =>
          pipe(
            firstObjectNamedNode(dataset, propertySubject, SH_PATH),
            O.map((path) =>
              ShaclPropertyShape.make({
                path,
                minCount: firstObjectInteger(dataset, propertySubject, SH_MIN_COUNT),
                maxCount: firstObjectInteger(dataset, propertySubject, SH_MAX_COUNT),
                datatype: firstObjectNamedNode(dataset, propertySubject, SH_DATATYPE),
                class: firstObjectNamedNode(dataset, propertySubject, SH_CLASS),
                hasValue: firstObjectTerm(dataset, propertySubject, SH_HAS_VALUE),
              })
            )
          )
        )
      )
    ),
    A.getSomes
  );

const extractShaclShapes = (dataset: Dataset): ReadonlyArray<ShaclNodeShape> =>
  pipe(
    nodeShapeSubjects(dataset),
    A.map((subject) =>
      ShaclNodeShape.make({
        id: subject.termType === "NamedNode" ? O.some(subject) : O.none(),
        targetNode: firstObjectNamedNode(dataset, subject, SH_TARGET_NODE),
        targetClass: firstObjectNamedNode(dataset, subject, SH_TARGET_CLASS),
        properties: propertyShapesFor(dataset, subject),
      })
    )
  );

const validationPartitions = (input: RunOntologyValidationInput): SessionGraphPartitions =>
  pipe(
    input.inference,
    O.match({
      onNone: () => deriveSessionGraphPartitions(input.session),
      onSome: (inference) => inferredSessionGraphPartitions(input.session, inference),
    })
  );

const validationDataset = (partitions: SessionGraphPartitions): Dataset =>
  makeDataset(
    pipe(partitions.asserted.quads, A.appendAll(partitions.ontologies.quads), A.appendAll(partitions.inferred.quads))
  );

const shaclFailure = (error: ShaclValidationError): OntologyValidationError =>
  OntologyValidationError.make({
    reason: "shaclFailed",
    message: error.message,
  });

const validationRequest = (
  input: RunOntologyValidationInput,
  partitions: SessionGraphPartitions,
  shapes: ReadonlyArray<ShaclNodeShape>
): ShaclValidationRequest =>
  ShaclValidationRequest.make({
    dataset: validationDataset(partitions),
    shapes,
    shapesDataset: O.some(partitions.shapes),
    maxResults: O.some(input.maxResults),
  });

const matchingRepairTarget = (
  shapes: ReadonlyArray<ShaclNodeShape>,
  violation: ShaclValidationViolation
): O.Option<ShapeRepairTarget> =>
  pipe(
    shapes,
    A.flatMap((shape) => A.map(shape.properties, (property) => ({ shape, property }))),
    A.findFirst(({ shape, property }) => {
      const shapeMatches = pipe(
        violation.sourceShape,
        O.match({
          onNone: () =>
            pipe(
              shape.targetNode,
              O.map((targetNode) => targetNode.value === violation.focusNode),
              O.getOrElse(() => true)
            ),
          onSome: (sourceShape) =>
            pipe(
              shape.id,
              O.exists((id) => sameNamedNode(id, sourceShape))
            ),
        })
      );
      return shapeMatches && property.path.value === violation.path.value;
    })
  );

type RepairSafety = "additive" | "corrective";

type RepairCandidate = {
  readonly operations: ReadonlyArray<ChangeOperation>;
  readonly safety: RepairSafety;
};

type RepairStrategy = {
  readonly component: NamedNode;
  readonly propose: (violation: ShaclValidationViolation, target: ShapeRepairTarget) => O.Option<RepairCandidate>;
};

const assertedAdd = (subject: Subject, predicate: NamedNode, object: ObjectTerm): ChangeOperation =>
  ChangeOperation.make({
    kind: "addQuad",
    partition: "asserted",
    quad: makeQuad(subject, predicate, object),
  });

const additiveValueCandidate = (
  violation: ShaclValidationViolation,
  target: ShapeRepairTarget
): O.Option<RepairCandidate> =>
  pipe(
    target.property.hasValue,
    O.map(
      (hasValue) =>
        ({
          operations: [assertedAdd(makeNamedNode(violation.focusNode), target.property.path, hasValue)],
          safety: "additive",
        }) satisfies RepairCandidate
    )
  );

const literalWithDatatype = (value: ObjectTerm, datatype: NamedNode): O.Option<ObjectTerm> =>
  ObjectTerm.match(value, {
    BlankNode: O.none<ObjectTerm>,
    Literal: (literalValue) =>
      pipe(
        literalValue.language,
        O.match({
          onNone: () => O.some(makeLiteral(literalValue.value, datatype.value)),
          onSome: O.none<ObjectTerm>,
        })
      ),
    NamedNode: O.none<ObjectTerm>,
  });

const namedFocusNode = S.decodeUnknownOption(NamedNode);

const datatypeCandidate = (violation: ShaclValidationViolation, target: ShapeRepairTarget): O.Option<RepairCandidate> =>
  pipe(
    O.all({
      datatype: target.property.datatype,
      subject: namedFocusNode({ termType: "NamedNode", value: violation.focusNode }),
      value: violation.value,
    }),
    O.flatMap(({ datatype, subject, value }) =>
      pipe(
        literalWithDatatype(value, datatype),
        O.map(
          (replacement) =>
            ({
              operations: [
                ChangeOperation.make({
                  kind: "removeQuad",
                  partition: "asserted",
                  quad: makeQuad(subject, target.property.path, value),
                }),
                assertedAdd(subject, target.property.path, replacement),
              ],
              safety: "corrective",
            }) satisfies RepairCandidate
        )
      )
    )
  );

const objectSubjectTerm = (value: ObjectTerm): O.Option<Subject> =>
  ObjectTerm.match(value, {
    BlankNode: O.some<Subject>,
    Literal: O.none<Subject>,
    NamedNode: O.some<Subject>,
  });

const classCandidate = (violation: ShaclValidationViolation, target: ShapeRepairTarget): O.Option<RepairCandidate> =>
  pipe(
    O.all({ classNode: target.property.class, value: violation.value }),
    O.flatMap(({ classNode, value }) =>
      pipe(
        objectSubjectTerm(value),
        O.map(
          (subject) =>
            ({
              operations: [assertedAdd(subject, RDF_TYPE, classNode)],
              safety: "additive",
            }) satisfies RepairCandidate
        )
      )
    )
  );

const repairStrategies: ReadonlyArray<RepairStrategy> = [
  { component: SH_HAS_VALUE_COMPONENT, propose: additiveValueCandidate },
  { component: SH_MIN_COUNT_COMPONENT, propose: additiveValueCandidate },
  { component: SH_DATATYPE_COMPONENT, propose: datatypeCandidate },
  { component: SH_CLASS_COMPONENT, propose: classCandidate },
];

const repairCandidate = (violation: ShaclValidationViolation, target: ShapeRepairTarget): O.Option<RepairCandidate> =>
  pipe(
    violation.sourceConstraintComponent,
    O.flatMap((component) =>
      pipe(
        repairStrategies,
        A.findFirst((strategy) => sameNamedNode(strategy.component, component)),
        O.flatMap((strategy) => strategy.propose(violation, target))
      )
    )
  );

const sameOptionalNamedNode = (left: O.Option<NamedNode>, right: O.Option<NamedNode>): boolean =>
  pipe(
    left,
    O.match({
      onNone: () => O.isNone(right),
      onSome: (leftNode) =>
        pipe(
          right,
          O.exists((rightNode) => sameNamedNode(leftNode, rightNode))
        ),
    })
  );

const sameViolation = (left: ShaclValidationViolation, right: ShaclValidationViolation): boolean =>
  left.focusNode === right.focusNode &&
  left.path.value === right.path.value &&
  sameOptionalNamedNode(left.sourceConstraintComponent, right.sourceConstraintComponent) &&
  pipe(
    left.sourceShape,
    O.match({
      onNone: () => O.isNone(right.sourceShape) && sameViolationDetails(left, right),
      onSome: (leftSourceShape) =>
        pipe(
          right.sourceShape,
          O.exists((rightSourceShape) => sameNamedNode(leftSourceShape, rightSourceShape))
        ),
    })
  );

const verifyRepair = Effect.fn("Ontology.Validation.verifyRepair")(function* (
  input: RunOntologyValidationInput,
  violation: ShaclValidationViolation,
  operations: ReadonlyArray<ChangeOperation>,
  shacl: ShaclValidationService["Service"],
  shapes: ReadonlyArray<ShaclNodeShape>
) {
  const applied = applyChangeOperationsWithDelta(input.session, operations);
  const nextInput = RunOntologyValidationInput.make({
    session: applied.session,
    inference: input.inference,
    maxResults: input.maxResults,
  });
  const partitions = validationPartitions(nextInput);
  const result = yield* shacl
    .validate(validationRequest(nextInput, partitions, shapes))
    .pipe(Effect.mapError(shaclFailure));
  return !pipe(
    result.violations,
    A.some((candidate) => sameViolation(candidate, violation))
  );
});

const repairProposal = Effect.fn("Ontology.Validation.repairProposal")(function* (
  input: RunOntologyValidationInput,
  shapes: ReadonlyArray<ShaclNodeShape>,
  shacl: ShaclValidationService["Service"],
  violation: ShaclValidationViolation,
  violationIndex: number
) {
  const candidate = pipe(
    matchingRepairTarget(shapes, violation),
    O.flatMap((target) => repairCandidate(violation, target))
  );
  return yield* pipe(
    candidate,
    O.match({
      onNone: () => Effect.succeed(O.none<OntologyRepairProposal>()),
      onSome: Effect.fn("Ontology.Validation.repairProposal.candidate")(function* (candidate) {
        const verified = yield* verifyRepair(input, violation, candidate.operations, shacl, shapes);
        return verified
          ? O.some(
              OntologyRepairProposal.make({
                id: `repair:${violationIndex}:${pipe(
                  candidate.operations,
                  A.map((operation) => serializeQuad(operation.quad)),
                  A.join("|")
                )}`,
                violationIndex: NonNegativeInt.make(violationIndex),
                focusNode: violation.focusNode,
                path: violation.path,
                message: `${candidate.safety} repair verified against the SHACL engine.`,
                operations: candidate.operations,
                verified,
              })
            )
          : O.none<OntologyRepairProposal>();
      }),
    })
  );
});

const runOntologyValidation = Effect.fn("Ontology.Validation.run")(function* (input: RunOntologyValidationInput) {
  const shacl = yield* ShaclValidationService;
  const partitions = validationPartitions(input);
  const shapes = extractShaclShapes(partitions.shapes);
  const validation = yield* shacl
    .validate(validationRequest(input, partitions, shapes))
    .pipe(Effect.mapError(shaclFailure));
  const repairs = yield* Effect.forEach(validation.violations, (violation, violationIndex) =>
    repairProposal(input, shapes, shacl, violation, violationIndex)
  ).pipe(Effect.map(A.getSomes));

  return RunOntologyValidationResult.make({
    validation,
    repairs,
    shapeCount: shapes.length,
    dataQuadCount: validationDataset(partitions).quads.length,
    inferredQuadCount: partitions.inferred.quads.length,
  });
});

const literal = (value: string) => makeLiteral(value, XSD_STRING.value);
const integer = (value: number) => makeLiteral(`${value}`, XSD_INTEGER.value);
const sessionIri = (session: Session, suffix: string): NamedNode =>
  makeNamedNode(`urn:beep:ontology:session:${encodeURIComponent(session.id)}:${suffix}`);

const provenanceDataset = (session: Session): Effect.Effect<Dataset, OntologyValidationError> => {
  const journal = sessionIri(session, "journal");
  const actorIris = pipe(
    session.changeLog,
    A.map((change) => O.fromUndefinedOr(change.actor)),
    O.all,
    O.map(A.dedupe)
  );
  if (O.isNone(actorIris)) {
    return Effect.fail(
      OntologyValidationError.make({
        reason: "actorIdentityMissing",
        message: "Every ontology change must carry an authenticated actor before PROV-O export.",
      })
    );
  }
  const baseQuads: ReadonlyArray<Quad> = [
    makeQuad(journal, RDF_TYPE, PROV_ENTITY),
    makeQuad(journal, dcterms("title"), literal(`Ontology workbench change journal for ${session.id}`)),
  ];
  const agentQuads = pipe(
    actorIris.value,
    A.map((actor) => makeQuad(makeNamedNode(actor), RDF_TYPE, PROV_AGENT))
  );
  const changeQuads = pipe(
    session.changeLog,
    A.flatMap((change, index) => {
      const activity = sessionIri(session, `change:${index + 1}`);
      return O.match(O.fromUndefinedOr(change.actor), {
        onNone: A.empty<Quad>,
        onSome: (actor) => [
          makeQuad(activity, RDF_TYPE, PROV_ACTIVITY),
          makeQuad(activity, PROV_USED, journal),
          makeQuad(journal, PROV_WAS_GENERATED_BY, activity),
          makeQuad(activity, prov("wasAssociatedWith"), makeNamedNode(actor)),
          makeQuad(activity, dcterms("identifier"), integer(index + 1)),
          makeQuad(activity, dcterms("type"), literal(change.kind)),
          makeQuad(activity, dcterms("description"), literal(serializeQuad(change.quad))),
        ],
      });
    })
  );
  return Effect.succeed(makeDataset(pipe(baseQuads, A.appendAll(agentQuads), A.appendAll(changeQuads))));
};

const datasetDescriptionDataset = (session: Session): Dataset => {
  const partitions = deriveSessionGraphPartitions(session);
  const dataset = sessionIri(session, "dataset");
  const distribution = sessionIri(session, "dataset:distribution");
  const assertedCount = partitions.asserted.quads.length;
  return makeDataset([
    makeQuad(dataset, RDF_TYPE, VOID_DATASET),
    makeQuad(dataset, RDF_TYPE, DCAT_DATASET),
    makeQuad(dataset, dcterms("title"), literal(`Ontology workbench asserted dataset ${session.id}`)),
    makeQuad(
      dataset,
      dcterms("description"),
      literal("Primary saved Turtle graph; derived graphs are exported separately.")
    ),
    makeQuad(dataset, VOID_TRIPLES, integer(assertedCount)),
    makeQuad(dataset, DCAT_DISTRIBUTION, distribution),
    makeQuad(distribution, RDF_TYPE, dcat("Distribution")),
    makeQuad(distribution, dcterms("format"), literal("text/turtle")),
  ]);
};

const exportPrefixes = (): PrefixMap =>
  PrefixMap.decodeUnknownSync({
    dcat: DCAT_NAMESPACE,
    dcterms: DCTERMS_NAMESPACE,
    prov: PROV_NAMESPACE,
    rdf: RDF_NAMESPACE,
    void: VOID_NAMESPACE,
    xsd: "http://www.w3.org/2001/XMLSchema#",
  });

const exportOntologyProvenance = Effect.fn("Ontology.Validation.exportProvenance")(function* (
  command: ExportOntologyProvenanceCommand
) {
  const turtle = yield* TurtleCodec;
  const fileStore = yield* OntologyFileStore;
  const prefixes = exportPrefixes();
  const provenance = yield* provenanceDataset(command.session);
  const provSerialized = yield* turtle.serialize(
    SerializeTurtleRequest.make({
      dataset: provenance,
      prefixes,
    })
  );
  const datasetSerialized = yield* turtle.serialize(
    SerializeTurtleRequest.make({
      dataset: datasetDescriptionDataset(command.session),
      prefixes,
    })
  );
  yield* fileStore.write(WriteOntologyFileRequest.make({ path: command.provPath, source: provSerialized.source }));
  yield* fileStore.write(
    WriteOntologyFileRequest.make({ path: command.datasetPath, source: datasetSerialized.source })
  );

  return ExportOntologyProvenanceResult.make({
    provPath: command.provPath,
    datasetPath: command.datasetPath,
    provSource: provSerialized.source,
    datasetSource: datasetSerialized.source,
  });
});

/**
 * Ontology validation runner service tag.
 *
 * **Example** (Yield validation runner service)
 *
 * ```ts
 * import { OntologyValidationRunner } from "@beep/ontology-use-cases/aggregates/Session"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const runner = yield* OntologyValidationRunner
 *   return runner
 * })
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OntologyValidationRunner extends Context.Service<
  OntologyValidationRunner,
  OntologyValidationRunnerShape
>()($I`OntologyValidationRunner`) {}

/**
 * Live ontology validation runner.
 *
 * **Example** (Reference live runner layer)
 *
 * ```ts
 * import { OntologyValidationRunnerLive } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(OntologyValidationRunnerLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const OntologyValidationRunnerLive = Layer.effect(
  OntologyValidationRunner,
  Effect.gen(function* () {
    const shacl = yield* ShaclValidationService;
    const turtle = yield* TurtleCodec;
    const fileStore = yield* OntologyFileStore;
    return OntologyValidationRunner.of({
      run: Effect.fn("OntologyValidationRunner.run")((input) =>
        runOntologyValidation(input).pipe(Effect.provideService(ShaclValidationService, shacl))
      ),
      exportProvenance: Effect.fn("OntologyValidationRunner.exportProvenance")((command) =>
        exportOntologyProvenance(command).pipe(
          Effect.provideService(TurtleCodec, turtle),
          Effect.provideService(OntologyFileStore, fileStore)
        )
      ),
    });
  })
);
