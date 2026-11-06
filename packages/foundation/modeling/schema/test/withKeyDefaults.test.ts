import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const Settings = S.Struct({ values: ArrayKeyDefaultEmpty(S.FiniteFromString) });

describe("ArrayKeyDefaultEmpty", () => {
  const TextSettings = S.Struct({ values: ArrayKeyDefaultEmpty(S.String) });

  it.effect.prop(
    "round-trips schema-derived arrays without dropping or changing their elements",
    [Arbitrary.schema(TextSettings)],
    Effect.fnUntraced(function* ([settings]) {
      const encoded = yield* S.encodeEffect(TextSettings)(settings);
      const value = yield* S.decodeEffect(TextSettings)(encoded);
      expect(value).toEqual(settings);
    })
  );

  it.effect("defaults absent keys while preserving element decoding and encoding", () =>
    Effect.gen(function* () {
      expect(Settings.make({}).values).toEqual([]);
      const value1 = yield* S.decodeEffect(Settings)({});
      expect(value1).toEqual({ values: [] });
      const value2 = yield* S.decodeEffect(Settings)({ values: ["42"] });
      expect(value2).toEqual({ values: [42] });
      const value3 = yield* S.encodeEffect(Settings)({ values: [42] });
      expect(value3).toEqual({ values: ["42"] });
      const value4 = yield* S.encodeEffect(Settings)({ values: [] });
      expect(value4).toEqual({ values: [] });
    })
  );

  it.effect("rejects explicit undefined and invalid elements", () =>
    Effect.gen(function* () {
      const isFailure5 = yield* Effect.isFailure(S.decodeUnknownEffect(Settings)({ values: undefined }));
      expect(isFailure5).toBe(true);
      const isFailure6 = yield* Effect.isFailure(S.decodeUnknownEffect(Settings)({ values: [42] }));
      expect(isFailure6).toBe(true);
    })
  );
});
