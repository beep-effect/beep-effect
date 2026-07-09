import {
  CreateSessionInput,
  createSession,
  SessionChangeDelta,
  SessionId,
} from "@beep/ontology-domain/aggregates/Session";
import {
  ApplyOntologyGraphProjectionDeltaInput,
  applyOntologyGraphProjectionDelta,
  buildOntologyGraphProjection,
  buildOntologySnapshot,
  defaultOntologyGraphProjectionOptions,
  graphGestureChangeOperations,
  makeSessionUseCases,
  OntologyFilePath,
  OntologyFileStore,
  OntologyGraphGesture,
  OntologyGraphProjectionOptions,
  OntologyMetrics,
  OntologyRelationshipSummary,
  OntologyResourceSummary,
  OntologySnapshot,
  OpenOntologyFileCommand,
  ParseTurtleResult,
  predicateAutocompleteSuggestions,
  ReadOntologyFileResult,
  SaveOntologyFileCommand,
  SerializeTurtleResult,
  searchOntologyResources,
  TurtleCodec,
} from "@beep/ontology-use-cases/aggregates/Session";
import { makeDataset, makeLiteral, makeNamedNode, makeQuad, PrefixMap } from "@beep/rdf/Rdf";
import { OWL_CLASS } from "@beep/rdf/Vocab/Owl";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_LABEL } from "@beep/rdf/Vocab/Rdfs";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal, Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const sessionId = S.decodeUnknownSync(SessionId)("session-1");
const fixturePath = S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl");
const dataset = makeDataset([
  makeQuad(
    makeNamedNode("https://example.test/alice"),
    makeNamedNode("https://example.test/name"),
    makeLiteral("Alice", XSD_STRING.value)
  ),
]);

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
