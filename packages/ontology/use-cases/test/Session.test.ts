import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session";
import {
  buildOntologySnapshot,
  makeSessionUseCases,
  OntologyFilePath,
  OntologyFileStore,
  OpenOntologyFileCommand,
  ParseTurtleResult,
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
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

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
});
