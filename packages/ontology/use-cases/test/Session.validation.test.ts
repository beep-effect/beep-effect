import {
  applyChangeOperationsWithDelta,
  ChangeOperation,
  CreateSessionInput,
  createSession,
  OntologyChangeActor,
  Session,
  SessionId,
} from "@beep/ontology-domain/aggregates/Session";
import {
  ExportOntologyProvenanceCommand,
  ExportOntologyProvenanceResult,
  OntologyFilePath,
  OntologyFileStore,
  OntologyValidationRunner,
  OntologyValidationRunnerLive,
  ParseTurtleResult,
  ReadOntologyFileResult,
  RunOntologyValidationInput,
  SerializeTurtleResult,
  TurtleCodec,
} from "@beep/ontology-use-cases/aggregates/Session";
import {
  makeBlankNode,
  makeDataset,
  makeLiteral,
  makeNamedNode,
  makeQuad,
  PrefixMap,
  serializeQuad,
} from "@beep/rdf/Rdf";
import { OWL_CLASS } from "@beep/rdf/Vocab/Owl";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_INTEGER } from "@beep/rdf/Vocab/Xsd";
import {
  ShaclValidationResult,
  ShaclValidationService,
  ShaclValidationViolation,
} from "@beep/semantic-web/services/shacl-validation";
import { ShaclValidationServiceLive } from "@beep/shacl";
import { A, O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, pipe } from "effect";
import * as S from "effect/Schema";
import type { Quad } from "@beep/rdf/Rdf";

const SHACL_NAMESPACE = "http://www.w3.org/ns/shacl#" as const;
const SH_NODE_SHAPE = makeNamedNode(`${SHACL_NAMESPACE}NodeShape`);
const SH_PROPERTY = makeNamedNode(`${SHACL_NAMESPACE}property`);
const SH_PATH = makeNamedNode(`${SHACL_NAMESPACE}path`);
const SH_TARGET_NODE = makeNamedNode(`${SHACL_NAMESPACE}targetNode`);
const SH_MIN_COUNT = makeNamedNode(`${SHACL_NAMESPACE}minCount`);
const SH_DATATYPE = makeNamedNode(`${SHACL_NAMESPACE}datatype`);
const SH_CLASS = makeNamedNode(`${SHACL_NAMESPACE}class`);
const SH_HAS_VALUE = makeNamedNode(`${SHACL_NAMESPACE}hasValue`);
const SH_MIN_COUNT_COMPONENT = makeNamedNode(`${SHACL_NAMESPACE}MinCountConstraintComponent`);
const SH_DATATYPE_COMPONENT = makeNamedNode(`${SHACL_NAMESPACE}DatatypeConstraintComponent`);
const SH_CLASS_COMPONENT = makeNamedNode(`${SHACL_NAMESPACE}ClassConstraintComponent`);
const SH_HAS_VALUE_COMPONENT = makeNamedNode(`${SHACL_NAMESPACE}HasValueConstraintComponent`);

const sessionId = S.decodeUnknownSync(SessionId)("session-validation");
const material = makeNamedNode("https://example.test/materials#Material");
const marker = makeNamedNode("https://example.test/marker");
const markerValue = makeNamedNode("https://example.test/marker-value");
const shape = makeNamedNode("urn:shape:material-class");
const property = makeBlankNode("shape-material-class-property");
const testActor = OntologyChangeActor.make("urn:beep:test:validation-actor");

const shapeOperations = (): ReadonlyArray<ChangeOperation> =>
  [
    makeQuad(shape, RDF_TYPE, SH_NODE_SHAPE),
    makeQuad(shape, SH_TARGET_NODE, material),
    makeQuad(shape, SH_PROPERTY, property),
    makeQuad(property, SH_PATH, RDF_TYPE),
    makeQuad(property, SH_HAS_VALUE, OWL_CLASS),
    makeQuad(property, SH_MIN_COUNT, makeLiteral("1", XSD_INTEGER.value)),
  ].map((quad) =>
    ChangeOperation.make({
      kind: "addQuad",
      partition: "shapes",
      quad,
      actor: testActor,
    })
  );

const testSession = (): Session =>
  applyChangeOperationsWithDelta(
    createSession(
      CreateSessionInput.make({
        id: sessionId,
        baseDataset: makeDataset([makeQuad(material, marker, markerValue)]),
      })
    ),
    shapeOperations()
  ).session;

describe("Ontology validation and provenance", () => {
  const writes = new Map<string, string>();
  const turtle = TurtleCodec.of({
    parse: Effect.fn("TurtleCodec.parse")(() =>
      Effect.succeed(ParseTurtleResult.make({ dataset: makeDataset([]), prefixes: PrefixMap.fromUnknown({}) }))
    ),
    serialize: Effect.fn("TurtleCodec.serialize")((request) =>
      Effect.succeed(SerializeTurtleResult.make({ source: request.dataset.quads.map(serializeQuad).join("\n") }))
    ),
  });
  const fileStore = OntologyFileStore.of({
    read: Effect.fn("OntologyFileStore.read")((request) =>
      Effect.succeed(ReadOntologyFileResult.make({ path: request.path, source: "" }))
    ),
    write: Effect.fn("OntologyFileStore.write")((request) =>
      Effect.sync(() => {
        writes.set(request.path, request.source);
      })
    ),
  });
  const ValidationTestLayer = OntologyValidationRunnerLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        ShaclValidationServiceLive,
        Layer.succeed(TurtleCodec, turtle),
        Layer.succeed(OntologyFileStore, fileStore)
      )
    )
  );
  const runWithLayer = <A2, E>(
    layer: Layer.Layer<OntologyValidationRunner, never, never>,
    effect: Effect.Effect<A2, E, OntologyValidationRunner>
  ): Effect.Effect<A2, E, never> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

  const runWithValidationLayer = <A2, E>(
    effect: Effect.Effect<A2, E, OntologyValidationRunner>
  ): Effect.Effect<A2, E, never> => runWithLayer(ValidationTestLayer, effect);

  it.effect(
    "matches hasValue repairs to the violation source shape when targetNode is absent",
    Effect.fnUntraced(function* () {
      const requiredA = makeNamedNode("https://example.test/required-a");
      const requiredB = makeNamedNode("https://example.test/required-b");
      const shapeA = makeNamedNode("urn:shape:marker-a");
      const shapeB = makeNamedNode("urn:shape:marker-b");
      const propertyA = makeBlankNode("marker-a-property");
      const propertyB = makeBlankNode("marker-b-property");
      const repairQuad = makeQuad(material, marker, requiredB);
      const session = applyChangeOperationsWithDelta(
        createSession(
          CreateSessionInput.make({
            id: sessionId,
            baseDataset: makeDataset([makeQuad(material, marker, markerValue)]),
          })
        ),
        [
          makeQuad(shapeA, RDF_TYPE, SH_NODE_SHAPE),
          makeQuad(shapeA, SH_PROPERTY, propertyA),
          makeQuad(propertyA, SH_PATH, marker),
          makeQuad(propertyA, SH_HAS_VALUE, requiredA),
          makeQuad(shapeB, RDF_TYPE, SH_NODE_SHAPE),
          makeQuad(shapeB, SH_PROPERTY, propertyB),
          makeQuad(propertyB, SH_PATH, marker),
          makeQuad(propertyB, SH_HAS_VALUE, requiredB),
        ].map((quad) =>
          ChangeOperation.make({
            kind: "addQuad",
            partition: "shapes",
            quad,
          })
        )
      ).session;
      const shacl = ShaclValidationService.of({
        validate: Effect.fn("ShaclValidationService.validate")((request) => {
          const repaired = request.dataset.quads.map(serializeQuad).includes(serializeQuad(repairQuad));
          return Effect.succeed(
            ShaclValidationResult.make({
              conforms: repaired,
              truncated: false,
              violations: repaired
                ? []
                : [
                    ShaclValidationViolation.make({
                      focusNode: material.value,
                      path: marker,
                      message: "Expected marker B.",
                      severity: "violation",
                      sourceShape: O.some(shapeB),
                      sourceConstraintComponent: O.some(SH_HAS_VALUE_COMPONENT),
                    }),
                  ],
            })
          );
        }),
      });
      const layer = OntologyValidationRunnerLive.pipe(
        Layer.provide(
          Layer.mergeAll(
            Layer.succeed(ShaclValidationService, shacl),
            Layer.succeed(TurtleCodec, turtle),
            Layer.succeed(OntologyFileStore, fileStore)
          )
        )
      );
      const result = yield* runWithLayer(
        layer,
        Effect.gen(function* () {
          const runner = yield* OntologyValidationRunner;
          return yield* runner.run(RunOntologyValidationInput.make({ session }));
        })
      );

      expect(result.repairs).toHaveLength(1);
      expect(result.repairs[0]?.operations.map((operation) => serializeQuad(operation.quad))).toEqual([
        serializeQuad(repairQuad),
      ]);
    })
  );

  it.effect(
    "offers verified minCount, datatype, and class repairs from the real SHACL engine",
    Effect.fnUntraced(function* () {
      yield* runWithValidationLayer(
        Effect.gen(function* () {
          const requiredPath = makeNamedNode("https://example.test/required");
          const agePath = makeNamedNode("https://example.test/age");
          const relatedPath = makeNamedNode("https://example.test/related");
          const relatedValue = makeNamedNode("https://example.test/related-value");
          const stringDatatype = makeNamedNode("http://www.w3.org/2001/XMLSchema#string");

          const runScenario = Effect.fn("OntologyValidationTest.runRepairScenario")(function* (
            data: ReadonlyArray<Quad>,
            propertyQuads: ReadonlyArray<Quad>,
            component: ReturnType<typeof makeNamedNode>
          ) {
            const propertyNode = makeBlankNode(`property-${component.value}`);
            const scenarioShape = makeNamedNode(`urn:shape:${component.value}`);
            const session = applyChangeOperationsWithDelta(
              createSession(
                CreateSessionInput.make({
                  id: sessionId,
                  baseDataset: makeDataset(data),
                })
              ),
              pipe(
                [
                  makeQuad(scenarioShape, RDF_TYPE, SH_NODE_SHAPE),
                  makeQuad(scenarioShape, SH_TARGET_NODE, material),
                  makeQuad(scenarioShape, SH_PROPERTY, propertyNode),
                  ...pipe(
                    propertyQuads,
                    A.map((quad) => makeQuad(propertyNode, quad.predicate, quad.object))
                  ),
                ],
                A.map((quad) =>
                  ChangeOperation.make({
                    kind: "addQuad",
                    partition: "shapes",
                    quad,
                  })
                )
              )
            ).session;
            const runner = yield* OntologyValidationRunner;
            const result = yield* runner.run(RunOntologyValidationInput.make({ session }));
            const repair = yield* pipe(
              result.repairs,
              A.findFirst((proposal) =>
                pipe(
                  A.get(result.validation.violations, proposal.violationIndex),
                  O.flatMap((violation) => violation.sourceConstraintComponent),
                  O.exists((candidate) => candidate.value === component.value)
                )
              ),
              O.match({
                onNone: () => Effect.die(`Missing repair for ${component.value}.`),
                onSome: Effect.succeed,
              })
            );
            const repaired = applyChangeOperationsWithDelta(session, repair.operations).session;
            const verified = yield* runner.run(RunOntologyValidationInput.make({ session: repaired }));

            expect(repair.verified).toBe(true);
            expect(verified.validation.conforms).toBe(true);
            return repair;
          });

          const minCountRepair = yield* runScenario(
            [makeQuad(material, marker, markerValue)],
            [
              makeQuad(material, SH_PATH, requiredPath),
              makeQuad(material, SH_MIN_COUNT, makeLiteral("1", XSD_INTEGER.value)),
              makeQuad(material, SH_HAS_VALUE, markerValue),
            ],
            SH_MIN_COUNT_COMPONENT
          );
          const datatypeRepair = yield* runScenario(
            [makeQuad(material, agePath, makeLiteral("7", stringDatatype.value))],
            [makeQuad(material, SH_PATH, agePath), makeQuad(material, SH_DATATYPE, XSD_INTEGER)],
            SH_DATATYPE_COMPONENT
          );
          const classRepair = yield* runScenario(
            [makeQuad(material, relatedPath, relatedValue)],
            [makeQuad(material, SH_PATH, relatedPath), makeQuad(material, SH_CLASS, OWL_CLASS)],
            SH_CLASS_COMPONENT
          );

          expect(minCountRepair.operations).toHaveLength(1);
          expect(
            pipe(
              datatypeRepair.operations,
              A.map((operation) => operation.kind)
            )
          ).toEqual(["removeQuad", "addQuad"]);
          expect(classRepair.operations).toHaveLength(1);
        })
      );
    }),
    { timeout: 120_000 }
  );

  it.effect(
    "verifies SHACL repairs, accepts undo, and exports provenance artifacts",
    Effect.fnUntraced(function* () {
      yield* runWithValidationLayer(
        Effect.gen(function* () {
          writes.clear();
          const runner = yield* OntologyValidationRunner;
          const initial = testSession();
          const violationResult = yield* runner.run(RunOntologyValidationInput.make({ session: initial }));

          expect(violationResult.validation.conforms).toBe(false);
          expect(violationResult.validation.violations.length).toBeGreaterThan(0);
          expect(violationResult.repairs.length).toBeGreaterThan(0);

          const repair = violationResult.repairs[0];
          expect(repair?.verified).toBe(true);
          const repaired = applyChangeOperationsWithDelta(
            initial,
            A.map(repair?.operations ?? [], (operation) => ChangeOperation.make({ ...operation, actor: testActor }))
          ).session;
          const repairedResult = yield* runner.run(RunOntologyValidationInput.make({ session: repaired }));

          expect(repairedResult.validation.conforms).toBe(true);
          expect(repairedResult.validation.violations).toHaveLength(0);

          const undone = Session.make({
            ...repaired,
            changeLog: pipe(repaired.changeLog, A.dropRight(repair?.operations.length ?? 0)),
          });
          const undoResult = yield* runner.run(RunOntologyValidationInput.make({ session: undone }));

          expect(undoResult.validation.conforms).toBe(false);
          expect(undoResult.validation.violations.length).toBeGreaterThan(0);

          const exported = yield* runner.exportProvenance(
            ExportOntologyProvenanceCommand.make({
              session: repaired,
              provPath: OntologyFilePath.fromUnknown("tmp/session-validation.prov.ttl"),
              datasetPath: OntologyFilePath.fromUnknown("tmp/session-validation.dataset.ttl"),
            })
          );

          expect(exported).toBeInstanceOf(ExportOntologyProvenanceResult);
          expect(writes.get(exported.provPath)).toContain("http://www.w3.org/ns/prov#Activity");
          expect(writes.get(exported.datasetPath)).toContain("http://rdfs.org/ns/void#triples");
        })
      );
    }),
    { timeout: 120_000 }
  );
});
