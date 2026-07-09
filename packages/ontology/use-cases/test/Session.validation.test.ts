import {
  applyChangeOperationsWithDelta,
  ChangeOperation,
  CreateSessionInput,
  createSession,
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
import { ShaclValidationServiceLive } from "@beep/shacl";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, pipe } from "effect";
import * as S from "effect/Schema";

const SHACL_NAMESPACE = "http://www.w3.org/ns/shacl#" as const;
const SH_NODE_SHAPE = makeNamedNode(`${SHACL_NAMESPACE}NodeShape`);
const SH_PROPERTY = makeNamedNode(`${SHACL_NAMESPACE}property`);
const SH_PATH = makeNamedNode(`${SHACL_NAMESPACE}path`);
const SH_TARGET_NODE = makeNamedNode(`${SHACL_NAMESPACE}targetNode`);
const SH_MIN_COUNT = makeNamedNode(`${SHACL_NAMESPACE}minCount`);
const SH_HAS_VALUE = makeNamedNode(`${SHACL_NAMESPACE}hasValue`);

const sessionId = S.decodeUnknownSync(SessionId)("session-validation");
const material = makeNamedNode("https://example.test/materials#Material");
const marker = makeNamedNode("https://example.test/marker");
const markerValue = makeNamedNode("https://example.test/marker-value");
const shape = makeNamedNode("urn:shape:material-class");
const property = makeBlankNode("shape-material-class-property");

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
  const runWithValidationLayer = <A2, E>(
    effect: Effect.Effect<A2, E, OntologyValidationRunner>
  ): Effect.Effect<A2, E, never> =>
    Effect.scoped(
      Layer.build(ValidationTestLayer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context))))
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
          const repaired = applyChangeOperationsWithDelta(initial, repair?.operations ?? []).session;
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
    })
  );
});
