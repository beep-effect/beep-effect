import { N3ParseTurtleRequest, N3SerializeTurtleRequest, N3TurtleCodec, N3TurtleCodecLive } from "@beep/n3";
import {
  Literal,
  MakeQuadOptionsInput,
  makeBlankNode,
  makeDataset,
  makeLiteral,
  makeNamedNode,
  makeQuad,
  PrefixMap,
} from "@beep/rdf/Rdf";
import { RDF_NAMESPACE } from "@beep/rdf/Vocab/Rdf";
import { XSD_DOUBLE } from "@beep/rdf/Vocab/Xsd";
import { it } from "@beep/test-runner";
import { expect, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as HashSet from "effect/HashSet";
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

      expect(HashSet.size(parsed.dataset.quads)).toBe(1);
      expect(parsed.prefixes).toEqual({ ex: "https://example.test/" });
      expect(serialized.source).toContain("@prefix ex:");
      expect(serialized.source).toContain("ex:alice");
      expect(serialized.source).toContain("Alice");
    })
  );

  it.effect(
    "serializes one quad set byte-identically whatever its insertion order",
    Effect.fnUntraced(function* () {
      const alice = makeNamedNode("https://example.test/alice");
      const bob = makeNamedNode("https://example.test/bob");
      const name = makeNamedNode("https://example.test/name");
      const quads = [
        makeQuad(alice, name, makeLiteral("Alice")),
        makeQuad(bob, name, Literal.langTagged("Bob", "EN")),
        makeQuad(alice, makeNamedNode("https://example.test/knows"), bob),
      ];
      const codec = yield* N3TurtleCodec;
      const prefixes = yield* decodePrefixMap({ ex: "https://example.test/" });
      const forward = yield* codec.serialize(N3SerializeTurtleRequest.make({ dataset: makeDataset(quads), prefixes }));
      const backward = yield* codec.serialize(
        N3SerializeTurtleRequest.make({ dataset: makeDataset([...quads].reverse()), prefixes })
      );
      const reparsed = yield* codec.parse(N3ParseTurtleRequest.make({ source: forward.source }));

      expect(backward.source).toBe(forward.source);
      expect(Equal.equals(reparsed.dataset, makeDataset(quads))).toBe(true);
    })
  );

  it.effect(
    "lowercases language tags and refuses a direction-tagged literal",
    Effect.fnUntraced(function* () {
      const codec = yield* N3TurtleCodec;
      const tagged = yield* codec.parse(
        N3ParseTurtleRequest.make({ source: '<https://example.test/a> <https://example.test/p> "x"@EN .' })
      );
      const directed = yield* codec
        .parse(N3ParseTurtleRequest.make({ source: '<https://example.test/a> <https://example.test/p> "x"@en--ltr .' }))
        .pipe(Effect.flip);

      expect(
        Equal.equals(
          tagged.dataset,
          makeDataset([
            makeQuad(
              makeNamedNode("https://example.test/a"),
              makeNamedNode("https://example.test/p"),
              Literal.langTagged("x", "en")
            ),
          ])
        )
      ).toBe(true);
      expect(directed.reason).toBe("parseFailed");
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
      const object = makeLiteral("Alice");
      const statement = makeBlankNode("confidence-statement");
      const dataset = makeDataset([
        makeQuad(subject, predicate, object),
        makeQuad(statement, makeNamedNode(`${RDF_NAMESPACE}type`), makeNamedNode(`${RDF_NAMESPACE}Statement`)),
        makeQuad(statement, makeNamedNode(`${RDF_NAMESPACE}subject`), subject),
        makeQuad(statement, makeNamedNode(`${RDF_NAMESPACE}predicate`), predicate),
        makeQuad(statement, makeNamedNode(`${RDF_NAMESPACE}object`), object),
        makeQuad(statement, makeNamedNode("https://example.test/confidence"), Literal.typed("0.8", XSD_DOUBLE.value)),
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
        makeQuad(
          makeNamedNode("https://example.test/alice"),
          makeNamedNode("https://example.test/name"),
          MakeQuadOptionsInput.make({
            object: makeLiteral("Alice"),
            graph: makeNamedNode("https://example.test/graph"),
          })
        ),
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
