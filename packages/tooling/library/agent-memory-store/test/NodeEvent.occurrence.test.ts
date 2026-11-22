import { NodeCreated, NodeCreatedEvent, OccurrenceAnchor } from "@beep/agent-memory-store";
import { TextAnchor } from "@beep/text";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import frozen from "./fixtures/node-created-v0.json" with { type: "json" };
import { anchor, author, contentHash, filePath, nodeId, otherNodeId, revisionA } from "./fixtures.ts";

// `fixtures/node-created-v0.json` holds the journal bytes of the two payloads below, in hex, exactly as
// `NodeCreatedEvent.payloadSchemaBinary` wrote them before the anchor schemas changed package. Journals on
// disk hold these bytes: the fixture is never regenerated.
const codec = NodeCreatedEvent.payloadSchemaBinary;
const Hex = S.Uint8ArrayFromHex;

const anchored = NodeCreated.make({
  nodeId,
  kind: "paragraph",
  contentHash,
  revisionId: revisionA,
  text: "A fact.",
  anchor: O.some(anchor),
  filePath,
  after: O.none(),
  author,
});
const unanchored = NodeCreated.make({
  nodeId,
  kind: "gap",
  contentHash,
  revisionId: revisionA,
  text: "\n\n",
  anchor: O.none(),
  filePath,
  after: O.some(otherNodeId),
  author,
});

const expectFrozen = Effect.fnUntraced(function* (hex: string, payload: NodeCreated) {
  const written = yield* S.encodeEffect(codec)(payload).pipe(Effect.flatMap(S.encodeEffect(Hex)));
  expect(written).toBe(hex);

  const read = yield* S.decodeEffect(Hex)(hex).pipe(Effect.flatMap(S.decodeUnknownEffect(codec)));
  expect(read).toEqual(payload);
  const rewritten = yield* S.encodeEffect(codec)(read).pipe(Effect.flatMap(S.encodeEffect(Hex)));
  expect(rewritten).toBe(hex);
});

describe("stored node events", () => {
  it.effect("a frozen node event with an anchor decodes and re-encodes unchanged", () =>
    expectFrozen(frozen.anchored, anchored)
  );

  it.effect("a frozen node event without an anchor decodes and re-encodes unchanged", () =>
    expectFrozen(frozen.unanchored, unanchored)
  );

  it.effect.prop(
    "any stored node event decodes and re-encodes to the same bytes",
    [Arbitrary.schema(NodeCreated)],
    ([payload]) =>
      Effect.gen(function* () {
        const written = yield* S.encodeEffect(codec)(payload);
        const rewritten = yield* S.decodeEffect(codec)(written).pipe(Effect.flatMap(S.encodeEffect(codec)));
        expect(rewritten).toEqual(written);
      }),
    { arbitrary: { runs: 50 } }
  );

  it.effect(
    "a stored event string never holds a lone surrogate",
    Effect.fnUntraced(function* () {
      // `text` and `author` refuse one at construction; a quote admits one and the binary codec replaces it.
      const payload = NodeCreated.make({
        ...anchored,
        anchor: OccurrenceAnchor.makeOption({
          ...anchor,
          anchor: TextAnchor.make({ startChar: 6, endChar: 10, quote: "f\ud800ct" }),
        }),
      });
      const read = yield* S.encodeEffect(codec)(payload).pipe(Effect.flatMap(S.decodeEffect(codec)));

      assertSome(
        O.map(read.anchor, (stored) => stored.anchor.quote),
        "f\ufffdct"
      );
    })
  );
});
