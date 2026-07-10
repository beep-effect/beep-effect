import { SessionId } from "@beep/ontology-domain/aggregates/Session";
import {
  makeSessionUseCases,
  OntologyFilePath,
  OntologyFileStore,
  OpenOntologyFileCommand,
  ParseTurtleResult,
  ReadOntologyFileResult,
  SaveOntologyFileCommand,
  SerializeTurtleResult,
  TurtleCodec,
} from "@beep/ontology-use-cases/aggregates/Session";
import { makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
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
    })
  );

  it.effect(
    "serializes the derived asserted graph when saving",
    Effect.fnUntraced(function* () {
      let written = "";
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
        parse: Effect.fn("TurtleCodec.parse")(() => Effect.succeed(ParseTurtleResult.make({ dataset }))),
        serialize: Effect.fn("TurtleCodec.serialize")(() =>
          Effect.succeed(SerializeTurtleResult.make({ source: "serialized turtle" }))
        ),
      });
      const useCases = yield* makeSessionUseCases().pipe(
        Effect.provideService(OntologyFileStore, fileStore),
        Effect.provideService(TurtleCodec, turtle)
      );
      const opened = yield* useCases.openFile(OpenOntologyFileCommand.make({ sessionId, path: fixturePath }));

      yield* useCases.saveFile(SaveOntologyFileCommand.make({ path: fixturePath, session: opened.session }));

      expect(written).toBe("serialized turtle");
    })
  );
});
