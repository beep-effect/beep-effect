import { Box, Cylinder, ModelSpec, Part, Prism } from "@beep/technical-drawing";
import { A, O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const decodeSpec = S.decodeUnknownEffect(ModelSpec);
const encodeSpec = S.encodeEffect(ModelSpec);
const SpecJson = S.fromJsonString(ModelSpec);
const encodeSpecJson = S.encodeEffect(SpecJson);
const decodeSpecJson = S.decodeEffect(SpecJson);
const decodeJson = S.decodeEffect(S.fromJsonString(S.Unknown));
// the encoded line style of every add primitive, absent when the encoded primitive has no lineStyle key
const PrimitiveKeys = S.Struct({
  parts: S.Array(S.Struct({ add: S.Array(S.Struct({ lineStyle: S.optionalKey(S.String) })) })),
});
const decodePrimitiveKeys = S.decodeUnknownEffect(PrimitiveKeys);
const encodeBox = S.encodeEffect(Box);
const decodeBox = S.decodeUnknownEffect(Box);

// A flap with a coplanar tab fused into it: the tab primitive alone is unclaimed.
const flapInput = {
  parts: [
    {
      name: "flap",
      add: [
        { kind: "box", min: [0, 0, 0], max: [40, 20, 2] },
        { kind: "box", min: [17, -8, 0], max: [23, 0, 2], lineStyle: "broken" },
        {
          kind: "prism",
          profile: [
            [0, 0, 0],
            [4, 0, 0],
            [0, 0, 2],
          ],
          extrusion: [0, 4, 0],
          lineStyle: "solid",
        },
      ],
    },
  ],
};

describe("Geometry.schemas primitive line style", () => {
  it.effect(
    "decodes a primitive's own line style and leaves the others to their part",
    Effect.fnUntraced(function* () {
      const spec = yield* decodeSpec(flapInput);
      expect(A.map(spec.parts, (part) => part.lineStyle)).toEqual(["solid"]);
      const styles = A.flatMap(spec.parts, (part) => A.map(part.add, (primitive) => primitive.lineStyle));
      expect(A.map(styles, O.isNone)).toEqual([true, false, false]);
      expect(A.getSomes(styles)).toEqual(["broken", "solid"]);
      // an unknown style is refused
      const refused = yield* Effect.flip(
        decodeSpec({
          parts: [{ name: "p", add: [{ kind: "box", min: [0, 0, 0], max: [1, 1, 1], lineStyle: "dotted" }] }],
        })
      );
      expect(refused).toBeDefined();
    })
  );

  it.effect(
    "encodes a primitive without a line style with no lineStyle key, and round-trips one with it",
    Effect.fnUntraced(function* () {
      const plain = ModelSpec.make({
        parts: [
          Part.make({
            name: "bracket",
            add: [
              Box.make({ min: [0, 0, 0], max: [60, 40, 6] }),
              Prism.make({
                profile: [
                  [0, 36, 6],
                  [0, 20, 6],
                  [0, 36, 22],
                ],
                extrusion: [4, 0, 0],
              }),
              Cylinder.make({ base: [14, 18, 6], axis: [0, 0, 1], radius: 5, height: 12 }),
            ],
          }),
        ],
      });
      const encoded = yield* encodeSpec(plain);
      const keys = yield* decodePrimitiveKeys(encoded);
      expect(A.flatMap(keys.parts, (part) => A.filter(part.add, (primitive) => "lineStyle" in primitive))).toEqual([]);
      // the key-less spec reads back to an equal spec, and a styled one keeps its style through JSON
      const decodedSpec = yield* decodeSpec(encoded);
      expect(decodedSpec).toEqual(plain);
      const styled = yield* decodeSpec(flapInput);
      const text = yield* encodeSpecJson(styled);
      const decodedSpecJson = yield* decodeSpecJson(text);
      expect(decodedSpecJson).toEqual(styled);
      const decodedJson = yield* decodeJson(text);
      const styledKeys = yield* decodePrimitiveKeys(decodedJson);
      expect(A.map(styledKeys.parts[0]?.add ?? [], (primitive) => primitive.lineStyle)).toEqual([
        undefined,
        "broken",
        "solid",
      ]);
    })
  );

  it.effect.prop(
    "round-trips any box, its line style included, through its encoded form",
    [Arbitrary.schema(Box)],
    Effect.fnUntraced(function* ([box]) {
      const encodedBox = yield* encodeBox(box);
      const decodedBox = yield* decodeBox(encodedBox);
      expect(decodedBox).toEqual(box);
    }),
    { arbitrary: { runs: 50 } }
  );
});
