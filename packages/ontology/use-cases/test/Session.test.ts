import {
  appendChange,
  applyChangeOperationsWithDelta,
  ChangeOperation,
  CreateSessionInput,
  createSession,
  graphPartitionIri,
  SessionChangeDelta,
  SessionId,
} from "@beep/ontology-domain/aggregates/Session";
import {
  ApplyOntologyGraphProjectionDeltaInput,
  applyOntologyGraphProjectionDelta,
  buildOntologyGraphProjection,
  buildOntologySnapshot,
  buildOntologySnapshotWithInference,
  defaultOntologyGraphProjectionOptions,
  graphGestureChangeOperations,
  InferOntologySessionInput,
  makeSessionUseCases,
  OntologyFilePath,
  OntologyFileStore,
  OntologyGraphGesture,
  OntologyGraphProjectionOptions,
  OntologyMetrics,
  OntologyReasoner,
  OntologyReasonerLive,
  OntologyRelationshipSummary,
  OntologyResourceSummary,
  OntologySnapshot,
  OntologySparqlRunner,
  OntologySparqlRunnerLive,
  OntologySparqlSafeguards,
  OpenOntologyFileCommand,
  ParseTurtleResult,
  predicateAutocompleteSuggestions,
  ReadOntologyFileResult,
  RunOntologySparqlInput,
  SaveOntologyFileCommand,
  SerializeTurtleResult,
  searchOntologyResources,
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
import { OWL_CLASS, OWL_NAMESPACE } from "@beep/rdf/Vocab/Owl";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_LABEL, RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { NonNegativeInt } from "@beep/schema";
import { SparqlQueryService, SparqlSelectResult } from "@beep/semantic-web/services/sparql-query";
import { fcRuns } from "@beep/test-utils";
import { O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal, Layer, Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const sessionId = S.decodeUnknownSync(SessionId)("session-1");
const fixturePath = S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl");
const SHACL_NAMESPACE = "http://www.w3.org/ns/shacl#" as const;
const SH_NODE_SHAPE = makeNamedNode(`${SHACL_NAMESPACE}NodeShape`);
const SH_PROPERTY = makeNamedNode(`${SHACL_NAMESPACE}property`);
const SH_PATH = makeNamedNode(`${SHACL_NAMESPACE}path`);
const aliceNameQuad = makeQuad(
  makeNamedNode("https://example.test/alice"),
  makeNamedNode("https://example.test/name"),
  makeLiteral("Alice", XSD_STRING.value)
);
const dataset = makeDataset([aliceNameQuad]);

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("Session use-cases", () => {
  it.effect(
    "round-trips schema-derived graph projection option samples",
    Effect.fnUntraced(function* () {
      fc.assert(
        fc.property(S.toArbitrary(OntologyGraphProjectionOptions), (options) => {
          const encoded = Result.getOrThrow(S.encodeResult(OntologyGraphProjectionOptions)(options));
          const decoded = Result.getOrThrow(S.decodeUnknownResult(OntologyGraphProjectionOptions)(encoded));

          expect(Equal.equals(decoded, options)).toBe(true);
        }),
        fcRuns(10)
      );
      yield* Effect.void;
    })
  );

  it.effect(
    "opens Turtle files through file-store and codec ports",
    Effect.fnUntraced(function* () {
      const fileStore = OntologyFileStore.of({
        read: Effect.fn("OntologyFileStore.read")((request) =>
          Effect.succeed(
            ReadOntologyFileResult.make({
              path: request.path,
              source: "@prefix ex: <https://example.test/> .",
            })
          )
        ),
        write: Effect.fn("OntologyFileStore.write")(() => Effect.void),
      });
      const turtle = TurtleCodec.of({
        parse: Effect.fn("TurtleCodec.parse")(() => Effect.succeed(ParseTurtleResult.make({ dataset }))),
        serialize: Effect.fn("TurtleCodec.serialize")(() => Effect.succeed(SerializeTurtleResult.make({ source: "" }))),
      });
      const useCases = yield* makeSessionUseCases().pipe(
        Effect.provideService(OntologyFileStore, fileStore),
        Effect.provideService(TurtleCodec, turtle)
      );

      const opened = yield* useCases.openFile(OpenOntologyFileCommand.make({ sessionId, path: fixturePath }));

      expect(opened.session.baseDataset.quads).toHaveLength(1);
      expect(opened.path).toBe(fixturePath);
      expect(opened.source).toBe("@prefix ex: <https://example.test/> .");
    })
  );

  it.effect(
    "preserves parsed prefixes when saving an opened session",
    Effect.fnUntraced(function* () {
      let written = "";
      let serializedPrefixes: PrefixMap = {};
      const fileStore = OntologyFileStore.of({
        read: Effect.fn("OntologyFileStore.read")((request) =>
          Effect.succeed(ReadOntologyFileResult.make({ path: request.path, source: "" }))
        ),
        write: Effect.fn("OntologyFileStore.write")((request) =>
          Effect.sync(() => {
            written = request.source;
          })
        ),
      });
      const turtle = TurtleCodec.of({
        parse: Effect.fn("TurtleCodec.parse")(() =>
          Effect.succeed(
            ParseTurtleResult.make({
              dataset,
              prefixes: S.decodeUnknownSync(PrefixMap)({
                ex: "https://example.test/",
              }),
            })
          )
        ),
        serialize: Effect.fn("TurtleCodec.serialize")((request) =>
          Effect.sync(() => {
            serializedPrefixes = request.prefixes;
            return SerializeTurtleResult.make({ source: "serialized turtle" });
          })
        ),
      });
      const useCases = yield* makeSessionUseCases().pipe(
        Effect.provideService(OntologyFileStore, fileStore),
        Effect.provideService(TurtleCodec, turtle)
      );
      const opened = yield* useCases.openFile(OpenOntologyFileCommand.make({ sessionId, path: fixturePath }));

      const saved = yield* useCases.saveFile(
        SaveOntologyFileCommand.make({ path: fixturePath, session: opened.session })
      );

      expect(written).toBe("serialized turtle");
      expect(saved.source).toBe("serialized turtle");
      expect(opened.session.prefixes).toEqual({ ex: "https://example.test/" });
      expect(serializedPrefixes).toEqual({ ex: "https://example.test/" });
    })
  );

  it.effect(
    "serializes opened SHACL shapes with asserted data",
    Effect.fnUntraced(function* () {
      let serializedQuads: ReadonlyArray<string> = [];
      const shape = makeNamedNode("urn:shape:alice-name");
      const property = makeBlankNode("alice-name-property");
      const shapeQuads = [
        makeQuad(shape, RDF_TYPE, SH_NODE_SHAPE),
        makeQuad(shape, SH_PROPERTY, property),
        makeQuad(property, SH_PATH, makeNamedNode("https://example.test/name")),
      ];
      const fileStore = OntologyFileStore.of({
        read: Effect.fn("OntologyFileStore.read")((request) =>
          Effect.succeed(ReadOntologyFileResult.make({ path: request.path, source: "" }))
        ),
        write: Effect.fn("OntologyFileStore.write")(() => Effect.void),
      });
      const turtle = TurtleCodec.of({
        parse: Effect.fn("TurtleCodec.parse")(() =>
          Effect.succeed(ParseTurtleResult.make({ dataset: makeDataset([aliceNameQuad, ...shapeQuads]) }))
        ),
        serialize: Effect.fn("TurtleCodec.serialize")((request) =>
          Effect.sync(() => {
            serializedQuads = request.dataset.quads.map(serializeQuad);
            return SerializeTurtleResult.make({ source: "serialized turtle" });
          })
        ),
      });
      const useCases = yield* makeSessionUseCases().pipe(
        Effect.provideService(OntologyFileStore, fileStore),
        Effect.provideService(TurtleCodec, turtle)
      );
      const opened = yield* useCases.openFile(OpenOntologyFileCommand.make({ sessionId, path: fixturePath }));

      yield* useCases.saveFile(SaveOntologyFileCommand.make({ path: fixturePath, session: opened.session }));

      expect(serializedQuads).toEqual([serializeQuad(aliceNameQuad), ...shapeQuads.map(serializeQuad)]);
    })
  );

  it.effect(
    "fails closed instead of silently dropping non-asserted partition changes on save",
    Effect.fnUntraced(function* () {
      let serialized = false;
      let written = false;
      const fileStore = OntologyFileStore.of({
        read: Effect.fn("OntologyFileStore.read")((request) =>
          Effect.succeed(ReadOntologyFileResult.make({ path: request.path, source: "" }))
        ),
        write: Effect.fn("OntologyFileStore.write")(() =>
          Effect.sync(() => {
            written = true;
          })
        ),
      });
      const turtle = TurtleCodec.of({
        parse: Effect.fn("TurtleCodec.parse")(() => Effect.succeed(ParseTurtleResult.make({ dataset }))),
        serialize: Effect.fn("TurtleCodec.serialize")(() =>
          Effect.sync(() => {
            serialized = true;
            return SerializeTurtleResult.make({ source: "serialized turtle" });
          })
        ),
      });
      const useCases = yield* makeSessionUseCases().pipe(
        Effect.provideService(OntologyFileStore, fileStore),
        Effect.provideService(TurtleCodec, turtle)
      );
      const session = appendChange(
        createSession(CreateSessionInput.make({ id: sessionId, baseDataset: dataset })),
        ChangeOperation.make({
          kind: "addQuad",
          partition: "ontologies",
          quad: makeQuad(makeNamedNode("https://example.test/alice"), makeNamedNode("https://example.test/knows"), {
            object: makeNamedNode("https://example.test/bob"),
            graph: makeNamedNode(graphPartitionIri("ontologies")),
          }),
        })
      );

      const error = yield* useCases
        .saveFile(SaveOntologyFileCommand.make({ path: fixturePath, session }))
        .pipe(Effect.flip);

      expect(error).toMatchObject({
        reason: "unsupportedPartition",
      });
      expect(serialized).toBe(false);
      expect(written).toBe(false);
    })
  );

  it.effect(
    "seeds structural inference on open and invalidates subclass closure incrementally",
    Effect.fnUntraced(function* () {
      const pizza = makeNamedNode("https://example.org/pizza#Pizza");
      const margherita = makeNamedNode("https://example.org/pizza#Margherita");
      const neapolitanMargherita = makeNamedNode("https://example.org/pizza#NeapolitanMargherita");
      const m1 = makeNamedNode("https://example.org/pizza#m1");
      const food = makeNamedNode("https://example.org/pizza#Food");
      const subClassOf = makeNamedNode(`${RDFS_NAMESPACE}subClassOf`);
      const inferredGraph = makeNamedNode(graphPartitionIri("inferred"));
      const openedDataset = makeDataset([
        makeQuad(pizza, RDF_TYPE, OWL_CLASS),
        makeQuad(margherita, RDF_TYPE, OWL_CLASS),
        makeQuad(margherita, subClassOf, pizza),
        makeQuad(neapolitanMargherita, RDF_TYPE, OWL_CLASS),
        makeQuad(neapolitanMargherita, subClassOf, margherita),
        makeQuad(m1, RDF_TYPE, neapolitanMargherita),
      ]);
      const inferredQuad = (subject: typeof pizza, predicate: typeof subClassOf, object: typeof pizza) =>
        serializeQuad(
          makeQuad(subject, predicate, {
            object,
            graph: inferredGraph,
          })
        );
      const fileStore = OntologyFileStore.of({
        read: Effect.fn("OntologyFileStore.read")((request) =>
          Effect.succeed(
            ReadOntologyFileResult.make({
              path: request.path,
              source: "@prefix : <https://example.org/pizza#> .",
            })
          )
        ),
        write: Effect.fn("OntologyFileStore.write")(() => Effect.void),
      });
      const turtle = TurtleCodec.of({
        parse: Effect.fn("TurtleCodec.parse")(() =>
          Effect.succeed(
            ParseTurtleResult.make({
              dataset: openedDataset,
              prefixes: S.decodeUnknownSync(PrefixMap)({
                pizza: "https://example.org/pizza#",
              }),
            })
          )
        ),
        serialize: Effect.fn("TurtleCodec.serialize")(() => Effect.succeed(SerializeTurtleResult.make({ source: "" }))),
      });
      const useCases = yield* makeSessionUseCases().pipe(
        Effect.provideService(OntologyFileStore, fileStore),
        Effect.provideService(TurtleCodec, turtle)
      );
      const reasoner = yield* OntologyReasoner;
      const opened = yield* useCases.openFile(OpenOntologyFileCommand.make({ sessionId, path: fixturePath }));
      const initial = yield* reasoner.infer(InferOntologySessionInput.make({ session: opened.session }));

      const initialQuads = initial.inferredDataset.quads.map(serializeQuad);
      expect(initial.fullRecompute).toBe(true);
      expect(initial.processedChangeCount).toBe(0);
      expect(initial.inferredDataset.quads).toHaveLength(3);
      expect(initialQuads).toEqual(
        expect.arrayContaining([
          inferredQuad(neapolitanMargherita, subClassOf, pizza),
          inferredQuad(m1, RDF_TYPE, margherita),
          inferredQuad(m1, RDF_TYPE, pizza),
        ])
      );
      expect(buildOntologySnapshotWithInference(opened.session, initial).metrics.quadCount).toBe(9);

      const pizzaFood = makeQuad(pizza, subClassOf, food);
      const added = applyChangeOperationsWithDelta(opened.session, [
        ChangeOperation.make({
          kind: "addQuad",
          partition: "asserted",
          quad: pizzaFood,
        }),
      ]);
      const addedInference = yield* reasoner.infer(
        InferOntologySessionInput.make({
          session: added.session,
          previous: O.some(initial),
        })
      );
      const addedQuads = addedInference.inferredDataset.quads.map(serializeQuad);

      expect(added.delta.added).toHaveLength(1);
      expect(addedInference.fullRecompute).toBe(false);
      expect(addedInference.processedChangeCount).toBe(1);
      expect(addedInference.modules.find((entry) => entry.module === "closure")?.mode).toBe("incremental");
      expect(addedInference.inferredDataset.quads).toHaveLength(6);
      expect(addedQuads).toEqual(
        expect.arrayContaining([
          inferredQuad(margherita, subClassOf, food),
          inferredQuad(neapolitanMargherita, subClassOf, food),
          inferredQuad(m1, RDF_TYPE, food),
        ])
      );
      expect(buildOntologySnapshotWithInference(added.session, addedInference).metrics.quadCount).toBe(13);

      const removed = applyChangeOperationsWithDelta(added.session, [
        ChangeOperation.make({
          kind: "removeQuad",
          partition: "asserted",
          quad: pizzaFood,
        }),
      ]);
      const removedInference = yield* reasoner.infer(
        InferOntologySessionInput.make({
          session: removed.session,
          previous: O.some(addedInference),
        })
      );
      const removedQuads = removedInference.inferredDataset.quads.map(serializeQuad);

      expect(removed.delta.removed).toHaveLength(1);
      expect(removedInference.fullRecompute).toBe(false);
      expect(removedInference.processedChangeCount).toBe(2);
      expect(removedInference.modules.find((entry) => entry.module === "closure")?.mode).toBe("incremental");
      expect(removedInference.inferredDataset.quads).toHaveLength(3);
      expect(removedQuads).toEqual(
        expect.arrayContaining([
          inferredQuad(neapolitanMargherita, subClassOf, pizza),
          inferredQuad(m1, RDF_TYPE, margherita),
          inferredQuad(m1, RDF_TYPE, pizza),
        ])
      );
      expect(removedQuads).not.toContain(inferredQuad(m1, RDF_TYPE, food));
      expect(buildOntologySnapshotWithInference(removed.session, removedInference).metrics.quadCount).toBe(9);
    }, provideScopedLayer(OntologyReasonerLive))
  );

  it.effect(
    "invalidates disjointness when non-type assertions change inferred type output",
    Effect.fnUntraced(function* () {
      const parent = makeNamedNode("https://example.test/Parent");
      const child = makeNamedNode("https://example.test/Child");
      const parentOf = makeNamedNode("https://example.test/parentOf");
      const alice = makeNamedNode("https://example.test/alice");
      const domain = makeNamedNode(`${RDFS_NAMESPACE}domain`);
      const range = makeNamedNode(`${RDFS_NAMESPACE}range`);
      const disjointWith = makeNamedNode(`${OWL_NAMESPACE}disjointWith`);
      const session = createSession(
        CreateSessionInput.make({
          id: sessionId,
          baseDataset: makeDataset([
            makeQuad(parentOf, domain, parent),
            makeQuad(parentOf, range, child),
            makeQuad(parent, disjointWith, child),
          ]),
        })
      );
      const reasoner = yield* OntologyReasoner;
      const initial = yield* reasoner.infer(InferOntologySessionInput.make({ session }));
      const added = applyChangeOperationsWithDelta(session, [
        ChangeOperation.make({
          kind: "addQuad",
          partition: "asserted",
          quad: makeQuad(alice, parentOf, alice),
        }),
      ]);
      const next = yield* reasoner.infer(
        InferOntologySessionInput.make({
          session: added.session,
          previous: O.some(initial),
        })
      );

      expect(initial.disjointnessViolations).toHaveLength(0);
      expect(next.modules.find((entry) => entry.module === "domainRange")?.mode).toBe("incremental");
      expect(next.modules.find((entry) => entry.module === "disjointness")?.mode).toBe("incremental");
      expect(next.disjointnessViolations).toEqual([
        expect.objectContaining({
          individualIri: alice.value,
          leftClassIri: child.value,
          rightClassIri: parent.value,
        }),
      ]);
    }, provideScopedLayer(OntologyReasonerLive))
  );

  it.effect(
    "accepts SPARQL queries whose form appears after blank and comment lines",
    Effect.fnUntraced(function* () {
      let submittedQuery = "";
      const session = createSession(CreateSessionInput.make({ id: sessionId, baseDataset: dataset }));
      const sparql = SparqlQueryService.of({
        execute: Effect.fn("SparqlQueryService.execute")((request) =>
          Effect.sync(() => {
            submittedQuery = request.query;
            return SparqlSelectResult.make({ profile: "select", rows: [] });
          })
        ),
      });

      yield* Effect.gen(function* () {
        const runner = yield* OntologySparqlRunner;
        const result = yield* runner.run(
          RunOntologySparqlInput.make({
            session,
            profile: "select",
            query: "# generated by workbench\n\nSELECT ?s WHERE { ?s ?p ?o }",
          })
        );

        expect(result.limitInjected).toBe(true);
      }).pipe(
        provideScopedLayer(OntologySparqlRunnerLive.pipe(Layer.provide(Layer.succeed(SparqlQueryService, sparql))))
      );

      expect(submittedQuery).toBe("# generated by workbench\n\nSELECT ?s WHERE { ?s ?p ?o }\nLIMIT 100");
    })
  );

  it.effect(
    "detects existing SPARQL LIMIT clauses separated by tabs or newlines",
    Effect.fnUntraced(function* () {
      let submittedQuery = "";
      const session = createSession(CreateSessionInput.make({ id: sessionId, baseDataset: dataset }));
      const sparql = SparqlQueryService.of({
        execute: Effect.fn("SparqlQueryService.execute")((request) =>
          Effect.sync(() => {
            submittedQuery = request.query;
            return SparqlSelectResult.make({ profile: "select", rows: [] });
          })
        ),
      });
      const query = "SELECT ?s WHERE { ?s ?p ?o }\nLIMIT\t50";

      yield* Effect.gen(function* () {
        const runner = yield* OntologySparqlRunner;
        const result = yield* runner.run(
          RunOntologySparqlInput.make({
            session,
            profile: "select",
            query,
            safeguards: OntologySparqlSafeguards.make({ defaultLimit: NonNegativeInt.make(10) }),
          })
        );

        expect(result.limitInjected).toBe(false);
      }).pipe(
        provideScopedLayer(OntologySparqlRunnerLive.pipe(Layer.provide(Layer.succeed(SparqlQueryService, sparql))))
      );

      expect(submittedQuery).toBe(query);
    })
  );

  it.effect(
    "uses one ABox/TBox classification rule for snapshots and search",
    Effect.fnUntraced(function* () {
      const pizzaClass = makeNamedNode("https://example.test/Pizza");
      const margherita = makeNamedNode("https://example.test/Margherita");
      const session = createSession(
        CreateSessionInput.make({
          id: sessionId,
          baseDataset: makeDataset([
            makeQuad(pizzaClass, RDF_TYPE, OWL_CLASS),
            makeQuad(pizzaClass, RDFS_LABEL, makeLiteral("Pizza", XSD_STRING.value)),
            makeQuad(margherita, RDF_TYPE, pizzaClass),
            makeQuad(margherita, RDFS_LABEL, makeLiteral("Margherita", XSD_STRING.value)),
          ]),
        })
      );

      const snapshot = buildOntologySnapshot(session);
      const tboxResults = searchOntologyResources(snapshot, { mode: "tbox", query: "pizza" });
      const aboxResults = searchOntologyResources(snapshot, { mode: "abox", query: "margherita" });

      expect(tboxResults.map((resource) => resource.iri)).toEqual(["https://example.test/Pizza"]);
      expect(aboxResults.map((resource) => resource.iri)).toEqual(["https://example.test/Margherita"]);
      yield* Effect.void;
    })
  );

  it.effect(
    "projects graph buffers through the shared ABox/TBox classification rule",
    Effect.fnUntraced(function* () {
      const pizzaClass = makeNamedNode("https://example.test/Pizza");
      const margherita = makeNamedNode("https://example.test/Margherita");
      const session = createSession(
        CreateSessionInput.make({
          id: sessionId,
          baseDataset: makeDataset([
            makeQuad(pizzaClass, RDF_TYPE, OWL_CLASS),
            makeQuad(margherita, RDF_TYPE, pizzaClass),
          ]),
        })
      );
      const snapshot = buildOntologySnapshot(session);
      const tbox = buildOntologyGraphProjection(
        snapshot,
        OntologyGraphProjectionOptions.make({
          ...defaultOntologyGraphProjectionOptions(),
          viewMode: "tbox",
          foldLevel: "L0",
        })
      );
      const abox = buildOntologyGraphProjection(
        snapshot,
        OntologyGraphProjectionOptions.make({
          ...defaultOntologyGraphProjectionOptions(),
          viewMode: "abox",
          foldLevel: "L0",
        })
      );

      expect(tbox.nodes.map((node) => node.iri)).toEqual(["https://example.test/Pizza"]);
      expect(abox.nodes.map((node) => node.iri)).toEqual(["https://example.test/Margherita"]);
      yield* Effect.void;
    })
  );

  it.effect(
    "folds annotations before structural and community clusters",
    Effect.fnUntraced(function* () {
      const parent = OntologyResourceSummary.make({
        iri: "https://example.test/Parent",
        label: "Parent",
        kind: "class",
        classification: "tbox",
        types: [],
        parentIris: [],
        sourcePartitions: ["asserted"],
      });
      const annotation = OntologyResourceSummary.make({
        iri: "https://example.test/comment",
        label: "comment",
        kind: "annotationProperty",
        classification: "tbox",
        types: [],
        parentIris: [],
        sourcePartitions: ["asserted"],
      });
      const children = Array.from({ length: 4 }, (_, index) =>
        OntologyResourceSummary.make({
          iri: `https://example.test/Child${index}`,
          label: `Child ${index}`,
          kind: "class",
          classification: "tbox",
          types: [],
          parentIris: [parent.iri],
          sourcePartitions: ["asserted"],
        })
      );
      const snapshot = OntologySnapshot.make({
        sessionId: "session-1",
        resources: [parent, annotation, ...children],
        hierarchy: [],
        relationships: [],
        metrics: OntologyMetrics.make({
          quadCount: 0,
          resourceCount: 6,
          classCount: 5,
          propertyCount: 1,
          individualCount: 0,
          tboxCount: 6,
          aboxCount: 0,
        }),
      });
      const projection = buildOntologyGraphProjection(
        snapshot,
        OntologyGraphProjectionOptions.make({
          ...defaultOntologyGraphProjectionOptions(),
          foldLevel: "L3",
          structuralFoldThreshold: 2,
          autoClusterThreshold: 2,
          communityBucketSize: 2,
        })
      );

      expect(projection.clusters.map((cluster) => cluster.foldLevel)).toContain("L1");
      expect(projection.clusters.map((cluster) => cluster.foldLevel)).toContain("L2");
      expect(projection.stats.foldedResourceCount).toBeGreaterThan(0);
      yield* Effect.void;
    })
  );

  it.effect(
    "applies graph projection deltas from SessionChangeDelta without full graph diffing",
    Effect.fnUntraced(function* () {
      const pizza = "https://example.test/Pizza";
      const margherita = "https://example.test/Margherita";
      const baseSnapshot = OntologySnapshot.make({
        sessionId: "session-1",
        resources: [
          OntologyResourceSummary.make({
            iri: pizza,
            label: "Pizza",
            kind: "class",
            classification: "tbox",
            types: [],
            parentIris: [],
            sourcePartitions: ["asserted"],
          }),
        ],
        hierarchy: [],
        relationships: [],
        metrics: OntologyMetrics.make({
          quadCount: 1,
          resourceCount: 1,
          classCount: 1,
          propertyCount: 0,
          individualCount: 0,
          tboxCount: 1,
          aboxCount: 0,
        }),
      });
      const nextSnapshot = OntologySnapshot.make({
        ...baseSnapshot,
        resources: [
          ...baseSnapshot.resources,
          OntologyResourceSummary.make({
            iri: margherita,
            label: "Margherita",
            kind: "individual",
            classification: "abox",
            types: [pizza],
            parentIris: [],
            sourcePartitions: ["asserted"],
          }),
        ],
        relationships: [
          OntologyRelationshipSummary.make({
            sourceIri: margherita,
            predicateIri: RDF_TYPE.value,
            objectIri: pizza,
            label: "type",
            sourcePartitions: ["asserted"],
          }),
        ],
      });
      const options = OntologyGraphProjectionOptions.make({
        ...defaultOntologyGraphProjectionOptions(),
        foldLevel: "L0",
      });
      const previous = buildOntologyGraphProjection(baseSnapshot, options);
      const delta = SessionChangeDelta.make({
        added: [makeQuad(makeNamedNode(margherita), RDF_TYPE, makeNamedNode(pizza))],
        removed: [],
      });
      const next = applyOntologyGraphProjectionDelta(
        ApplyOntologyGraphProjectionDeltaInput.make({ previous, snapshot: nextSnapshot, delta, options })
      );

      expect(next.revision).toBe(previous.revision + 1);
      expect(next.edgeCount).toBe(1);
      expect(next.changedNodeIds.length).toBeGreaterThan(0);
      yield* Effect.void;
    })
  );

  it.effect(
    "converts visualizer gestures to typed change operations and suggests predicates",
    Effect.fnUntraced(function* () {
      const operations = graphGestureChangeOperations(
        OntologyGraphGesture.make({
          kind: "instantiate",
          classIri: "https://example.test/Pizza",
          instanceIri: "https://example.test/Margherita",
        })
      );
      const suggestions = predicateAutocompleteSuggestions(
        OntologySnapshot.make({
          sessionId: "session-1",
          resources: [],
          hierarchy: [],
          relationships: [],
          metrics: OntologyMetrics.make({
            quadCount: 0,
            resourceCount: 0,
            classCount: 0,
            propertyCount: 0,
            individualCount: 0,
            tboxCount: 0,
            aboxCount: 0,
          }),
        }),
        "type"
      );

      expect(operations).toHaveLength(1);
      expect(operations[0]?.kind).toBe("addQuad");
      expect(suggestions[0]?.iri).toBe(RDF_TYPE.value);
      yield* Effect.void;
    })
  );
});

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema): void => {
  const decode = S.decodeUnknownResult(schema);
  const encode = S.encodeResult(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(S.toArbitrary(schema), (value) => {
      const encoded = Result.getOrThrow(encode(value));
      const decoded = Result.getOrThrow(decode(encoded));

      expect(equivalent(decoded, value)).toBe(true);
    }),
    fcRuns(10)
  );
};

describe("Session use-case schema round-trips", () => {
  it("round-trips session schemas with schema-derived arbitraries", () => {
    assertSchemaRoundTrip(CreateSessionInput);
    assertSchemaRoundTrip(ChangeOperation);
  });
});
