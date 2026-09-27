import { N3ParseTurtleRequest, N3SerializeTurtleRequest, N3TurtleCodec, N3TurtleCodecLive } from "@beep/n3";
import { makeBlankNode, makeDataset, makeLiteral, makeNamedNode, makeQuad, PrefixMap } from "@beep/rdf/Rdf";
import { RDF_NAMESPACE } from "@beep/rdf/Vocab/Rdf";
import { XSD_DOUBLE, XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { it } from "@beep/test-runner";
import { expect, vi } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { Writer } from "n3";
import type * as N3 from "n3";

const decodePrefixMap = S.decodeEffect(PrefixMap);

it.layer(N3TurtleCodecLive)("N3TurtleCodec", (it) => {
  it.effect(
    "parses and serializes Turtle over @beep/rdf values",
    Effect.fnUntraced(function* () {
      const source = `
          @prefix ex: <https://example.test/> .
          ex:alice ex:name "Alice" .
        `;
      const codec = yield* N3TurtleCodec;
      const parsed = yield* codec.parse(N3ParseTurtleRequest.make({ source }));
      const serialized = yield* codec.serialize(
        N3SerializeTurtleRequest.make({ dataset: parsed.dataset, prefixes: parsed.prefixes })
      );

      expect(parsed.dataset.quads).toHaveLength(1);
      expect(parsed.prefixes).toEqual({ ex: "https://example.test/" });
      expect(serialized.source).toContain("@prefix ex:");
      expect(serialized.source).toContain("ex:alice");
      expect(serialized.source).toContain("Alice");
    })
  );

  it.effect(
    "round-trips the default Turtle prefix",
    Effect.fnUntraced(function* () {
      const source = `
          @prefix : <https://example.test/> .
          :alice :name "Alice" .
        `;
      const codec = yield* N3TurtleCodec;
      const parsed = yield* codec.parse(N3ParseTurtleRequest.make({ source }));
      const serialized = yield* codec.serialize(
        N3SerializeTurtleRequest.make({ dataset: parsed.dataset, prefixes: parsed.prefixes })
      );

      expect(parsed.prefixes).toEqual({ "": "https://example.test/" });
      expect(serialized.source).toContain("@prefix :");
      expect(serialized.source).toContain(":alice");
    })
  );

  it.effect(
    "serializes standard RDF reification datasets",
    Effect.fnUntraced(function* () {
      const subject = makeNamedNode("https://example.test/alice");
      const predicate = makeNamedNode("https://example.test/name");
      const object = makeLiteral("Alice", XSD_STRING.value);
      const statement = makeBlankNode("confidence-statement");
      const dataset = makeDataset([
        makeQuad(subject, predicate, object),
        makeQuad(statement, makeNamedNode(`${RDF_NAMESPACE}type`), makeNamedNode(`${RDF_NAMESPACE}Statement`)),
        makeQuad(statement, makeNamedNode(`${RDF_NAMESPACE}subject`), subject),
        makeQuad(statement, makeNamedNode(`${RDF_NAMESPACE}predicate`), predicate),
        makeQuad(statement, makeNamedNode(`${RDF_NAMESPACE}object`), object),
        makeQuad(statement, makeNamedNode("https://example.test/confidence"), makeLiteral("0.8", XSD_DOUBLE.value)),
      ]);
      const codec = yield* N3TurtleCodec;
      const prefixes = yield* decodePrefixMap({ rdf: RDF_NAMESPACE });
      const serialized = yield* codec.serialize(N3SerializeTurtleRequest.make({ dataset, prefixes }));

      expect(serialized.source).toContain("rdf:Statement");
      expect(serialized.source).toContain("rdf:subject");
      expect(serialized.source).toContain("0.8");
    })
  );

  it.effect(
    "rejects named graph quads for Turtle serialization",
    Effect.fnUntraced(function* () {
      const dataset = makeDataset([
        makeQuad(makeNamedNode("https://example.test/alice"), makeNamedNode("https://example.test/name"), {
          object: makeLiteral("Alice", XSD_STRING.value),
          graph: makeNamedNode("https://example.test/graph"),
        }),
      ]);
      const codec = yield* N3TurtleCodec;
      const error = yield* codec.serialize(N3SerializeTurtleRequest.make({ dataset })).pipe(Effect.flip);

      expect(error).toMatchObject({
        reason: "unsupportedGraph",
      });
    })
  );

  it.effect(
    "propagates writer callback errors",
    Effect.fnUntraced(function* () {
      const writerFailure = new Error("writer callback failed");
      yield* Effect.acquireRelease(
        Effect.sync(() =>
          vi.spyOn(Writer.prototype, "end").mockImplementation((done?: N3.ErrorCallback): void => {
            if (done !== undefined) done(writerFailure, "");
          })
        ),
        (spy) => Effect.sync(() => spy.mockRestore())
      );
      const codec = yield* N3TurtleCodec;
      const error = yield* codec
        .serialize(N3SerializeTurtleRequest.make({ dataset: makeDataset([]) }))
        .pipe(Effect.flip);

      expect(error).toMatchObject({
        message: "writer callback failed",
        reason: "serializeFailed",
      });
    }),
    { concurrent: false }
  );
});
