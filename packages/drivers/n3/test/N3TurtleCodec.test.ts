import { N3ParseTurtleRequest, N3SerializeTurtleRequest, N3TurtleCodec, N3TurtleCodecLive } from "@beep/n3";
import { makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { Writer } from "n3";
import { vi } from "vitest";
import type * as N3 from "n3";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("N3TurtleCodec", () => {
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
    }, provideScopedLayer(N3TurtleCodecLive))
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
    }, provideScopedLayer(N3TurtleCodecLive))
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
    }, provideScopedLayer(N3TurtleCodecLive))
  );

  it.effect(
    "propagates writer callback errors",
    Effect.fnUntraced(function* () {
      const writerFailure = new Error("writer callback failed");
      const endSpy = vi.spyOn(Writer.prototype, "end").mockImplementation((done?: N3.ErrorCallback): void => {
        if (done !== undefined) {
          done(writerFailure, "");
        }
      });
      const codec = yield* N3TurtleCodec;
      const error = yield* codec
        .serialize(N3SerializeTurtleRequest.make({ dataset: makeDataset([]) }))
        .pipe(Effect.flip, Effect.ensuring(Effect.sync(() => endSpy.mockRestore())));

      expect(error).toMatchObject({
        message: "writer callback failed",
        reason: "serializeFailed",
      });
    }, provideScopedLayer(N3TurtleCodecLive))
  );
});
