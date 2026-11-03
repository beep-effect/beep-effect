import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

import { JsoncCodec } from "@beep/config-file/JsoncCodec";

const equivalent = S.toEquivalence(S.Json);
const JsonText = S.fromJsonString(S.Json);

describe("JsoncCodec properties", () => {
  it.effect.prop(
    "parse(stringify(x)) recovers every JSON value without failure",
    [Arbitrary.schema(S.Json)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* JsoncCodec.stringify(value);
        const argument = S.decodeUnknownEffect(S.Json);
        const parsed1 = yield* JsoncCodec.parse(encoded);
        const decoded = yield* argument(parsed1);
        assert.isTrue(equivalent(decoded, value));
      }),
    runs
  );

  it.effect.prop(
    "normalization is idempotent and parse/stringify preserves the parsed document",
    [Arbitrary.schema(S.Json)],
    ([value]) =>
      Effect.gen(function* () {
        const input = yield* S.encodeEffect(JsonText)(value);
        const parsed = yield* JsoncCodec.parse(`/* leading comment */${input}/* trailing comment */`);
        const formatted = yield* JsoncCodec.stringify(parsed);
        const reparsed = yield* JsoncCodec.parse(formatted);
        assert.deepStrictEqual(reparsed, parsed);
        const stringify1 = yield* JsoncCodec.stringify(reparsed);
        assert.strictEqual(stringify1, formatted);
      }),
    runs
  );
});
