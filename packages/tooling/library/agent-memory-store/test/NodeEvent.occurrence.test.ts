import { NodeCreated, NodeCreatedEvent, OccurrenceAnchor, occurrenceIdOf } from "@beep/agent-memory-store";
import { TextAnchor } from "@beep/text";
import { Anchored, mintOccurrenceId, OccurrenceId } from "@beep/text/Occurrence";
import { TextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import frozen from "./fixtures/node-created-v0.json" with { type: "json" };
import { anchor, author, contentHash, filePath, nodeId, otherNodeId, revisionA } from "./fixtures.ts";

const codec = NodeCreatedEvent.payloadSchemaBinary;
const p2DesignSection6GoldenOccurrenceId = OccurrenceId.make(
  "sha256:654d949fc9259fd7b3b3d90ef96c270b444cfece9feb03f15dfe29013001a06d"
);
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
  expect(
    written,
    "the journal bytes payloadSchemaBinary wrote before the anchor schemas moved package; never regenerated"
  ).toBe(hex);

  const read = yield* S.decodeEffect(Hex)(hex).pipe(Effect.flatMap(S.decodeUnknownEffect(codec)));
  expect(read).toEqual(payload);
  const rewritten = yield* S.encodeEffect(codec)(read).pipe(Effect.flatMap(S.encodeEffect(Hex)));
  expect(rewritten).toBe(hex);
});

it.layer(Digest.layerWebCrypto)("stored node event occurrence ids", (it) => {
  it.effect(
    "a frozen node event reads to its OccurrenceId",
    Effect.fnUntraced(function* () {
      yield* expectFrozen(frozen.anchored, anchored);

      const read = yield* S.decodeEffect(Hex)(frozen.anchored).pipe(Effect.flatMap(S.decodeUnknownEffect(codec)));
      const stored = yield* Effect.fromOption(read.anchor);
      const id = yield* occurrenceIdOf(stored);
      expect(id).toBe(p2DesignSection6GoldenOccurrenceId);
      const fromReceipt = yield* mintOccurrenceId(
        Anchored.make({ receipt: TextAnchorVerificationReceipt.make({ source: stored.source, anchor: stored.anchor }) })
      );
      expect(fromReceipt, "the equivalent anchors-table receipt, the route of L1-4, mints the same id").toBe(id);
    })
  );

  it.effect(
    "an anchor whose quote holds a lone surrogate mints no OccurrenceId",
    Effect.fnUntraced(function* () {
      const error = yield* occurrenceIdOf(
        OccurrenceAnchor.make({
          ...anchor,
          anchor: TextAnchor.make({ startChar: 6, endChar: 10, quote: "f\ud800ct" }),
        })
      ).pipe(Effect.flip);
      expect(S.isSchemaError(error)).toBe(true);
    })
  );
});

describe("stored node events", () => {
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
    "a stored event string never holds a lone surrogate: text and author refuse one, the binary codec replaces one in a quote",
    Effect.fnUntraced(function* () {
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
