import { fileURLToPath } from "node:url";
import {
  applyChangeOperationsWithDelta,
  ChangeOperation,
  CreateSessionInput,
  createSession,
  SessionId,
} from "@beep/ontology-domain/aggregates/Session";
import { OntologyServerTest } from "@beep/ontology-server/test";
import {
  InferOntologySessionInput,
  OntologyFilePath,
  OntologyFileStore,
  OntologyReasoner,
  OntologyValidationRunner,
  ParseTurtleRequest,
  ReadOntologyFileRequest,
  RunOntologyValidationInput,
  TurtleCodec,
} from "@beep/ontology-use-cases/aggregates/Session";
import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import { makeDataset } from "@beep/rdf/Rdf";
import { SparqlQueryRequest, SparqlQueryService } from "@beep/semantic-web/services/sparql-query";
import { A, O } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Layer } from "effect";
import * as S from "effect/Schema";
import type { Dataset } from "@beep/rdf/Rdf";

type TaskFixture = {
  readonly id: string;
  readonly expectedAskValues: ReadonlyArray<boolean>;
  readonly expectedDisjointnessViolationCount: number;
  readonly expectedCompetencyPass: boolean;
  readonly reason: string;
};

const fixturesRoot = fileURLToPath(new URL("./fixtures/ontoauthor-mat/", import.meta.url));

const TestLayer = Layer.mergeAll(
  OntologyServerTest.pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ ONTOLOGY_WORKSPACE_ROOT: fixturesRoot }))),
    Layer.provide(NodeServices.layer)
  ),
  OxigraphSparqlQueryServiceLive,
  NodeServices.layer
);

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const taskFixtures: ReadonlyArray<TaskFixture> = [
  {
    id: "t1-subsumption",
    expectedAskValues: [true, true],
    expectedDisjointnessViolationCount: 0,
    expectedCompetencyPass: true,
    reason: "RDFS subclass/type closure is covered by the bounded structural reasoner.",
  },
  {
    id: "t2-existential",
    expectedAskValues: [false, true],
    expectedDisjointnessViolationCount: 0,
    expectedCompetencyPass: false,
    reason: "OWL equivalentClass plus someValuesFrom classification is outside the bounded structural reasoner.",
  },
  {
    id: "t3-universal",
    expectedAskValues: [false, true],
    expectedDisjointnessViolationCount: 0,
    expectedCompetencyPass: false,
    reason: "OWL equivalentClass plus allValuesFrom classification is outside the bounded structural reasoner.",
  },
  {
    id: "t4-disjointness",
    expectedAskValues: [true, true],
    expectedDisjointnessViolationCount: 0,
    expectedCompetencyPass: true,
    reason: "The task is structurally consistent and the declared disjoint classes have separate individuals.",
  },
  {
    id: "t5-sameas",
    expectedAskValues: [true, true],
    expectedDisjointnessViolationCount: 0,
    expectedCompetencyPass: true,
    reason: "The sameAs assertion and duplicate datatype facts are structurally present in the reference graph.",
  },
  {
    id: "t6-unsatisfiability",
    expectedAskValues: [true, true],
    expectedDisjointnessViolationCount: 1,
    expectedCompetencyPass: true,
    reason: "The bounded disjointness detector flags the deliberately contradictory individual.",
  },
];

const fixturePath = (relativePath: string): OntologyFilePath => S.decodeSync(OntologyFilePath)(relativePath);

const fixtureFilePath = (relativePath: string): string =>
  fileURLToPath(new URL(`./fixtures/ontoauthor-mat/${relativePath}`, import.meta.url));

const readTextFixture = Effect.fn("OntoauthorMat.readTextFixture")(function* (relativePath: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  return yield* fileSystem.readFileString(fixtureFilePath(relativePath));
});

const readFixture = Effect.fn("OntoauthorMat.readFixture")(function* (path: OntologyFilePath) {
  const fileStore = yield* OntologyFileStore;
  return yield* fileStore.read(ReadOntologyFileRequest.make({ path }));
});

const parseFixture = Effect.fn("OntoauthorMat.parseFixture")(function* (path: OntologyFilePath) {
  const turtle = yield* TurtleCodec;
  const file = yield* readFixture(path);
  return yield* turtle.parse(ParseTurtleRequest.make({ source: file.source }));
});

const askQueries = (source: string): ReadonlyArray<string> => source.match(/ASK\s*\{[\s\S]*?\n\}/g) ?? [];

const shapeOperations = (dataset: Dataset): ReadonlyArray<ChangeOperation> =>
  A.map(dataset.quads, (quad) =>
    ChangeOperation.make({
      kind: "addQuad",
      partition: "shapes",
      quad,
    })
  );

const executeAsk = Effect.fn("OntoauthorMat.executeAsk")(function* (query: string, dataset: Dataset) {
  const sparql = yield* SparqlQueryService;
  const result = yield* sparql.execute(
    SparqlQueryRequest.make({
      query,
      profile: "ask",
      dataset,
    })
  );

  expect(result.profile).toBe("ask");
  return result.profile === "ask" ? result.value : false;
});

const runTask = Effect.fn("OntoauthorMat.runTask")(function* (fixture: TaskFixture) {
  const task = yield* readTextFixture(`${fixture.id}/task.md`);
  const cq = yield* readTextFixture(`${fixture.id}/cq.sparql`);
  const reference = yield* parseFixture(fixturePath(`${fixture.id}/reference.ttl`));
  const shapes = yield* parseFixture(fixturePath(`${fixture.id}/shapes.ttl`));
  const sessionId = yield* S.decodeEffect(SessionId)(`ontoauthor-${fixture.id}`);
  const baseSession = createSession(
    CreateSessionInput.make({
      id: sessionId,
      baseDataset: reference.dataset,
      prefixes: reference.prefixes,
    })
  );
  const session = applyChangeOperationsWithDelta(baseSession, shapeOperations(shapes.dataset)).session;
  const reasoner = yield* OntologyReasoner;
  const inference = yield* reasoner.infer(InferOntologySessionInput.make({ session }));
  const validationRunner = yield* OntologyValidationRunner;
  const validation = yield* validationRunner.run(
    RunOntologyValidationInput.make({
      session,
      inference: O.some(inference),
    })
  );
  const sparqlDataset = makeDataset([...reference.dataset.quads, ...inference.inferredDataset.quads]);
  const actualAskValues = yield* Effect.forEach(askQueries(cq), (query) => executeAsk(query, sparqlDataset));
  const competencyPass =
    validation.validation.conforms &&
    actualAskValues.length === fixture.expectedAskValues.length &&
    actualAskValues.every((value) => value) &&
    inference.disjointnessViolations.length === fixture.expectedDisjointnessViolationCount;

  return {
    id: fixture.id,
    taskTitle: task.split("\n")[0] ?? fixture.id,
    shaclConforms: validation.validation.conforms,
    shapeCount: validation.shapeCount,
    askValues: actualAskValues,
    disjointnessViolationCount: inference.disjointnessViolations.length,
    competencyPass,
    reason: fixture.reason,
  };
});

describe("OntoAuthor-Mat competency fixtures", () => {
  it.effect(
    "executes t1-t6 through Turtle, Oxigraph ASK, structural inference, and SHACL validation",
    Effect.fnUntraced(function* () {
      const results = yield* Effect.forEach(taskFixtures, runTask);

      expect(results).toEqual(
        taskFixtures.map((fixture, index) => ({
          id: fixture.id,
          taskTitle: results[index]?.taskTitle,
          shaclConforms: true,
          shapeCount: expect.any(Number),
          askValues: fixture.expectedAskValues,
          disjointnessViolationCount: fixture.expectedDisjointnessViolationCount,
          competencyPass: fixture.expectedCompetencyPass,
          reason: fixture.reason,
        }))
      );
    }, provideScopedLayer(TestLayer)),
    { timeout: 120_000 }
  );
});
