import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

import { JsonCodec } from "@beep/config-file/JsonCodec";

const equivalent = S.toEquivalence(S.Json);
const JsonText = S.fromJsonString(S.Json);

describe("JsonCodec properties", () => {
  it.effect.prop(
    "parse(stringify(x)) recovers every JSON value without failure",
    [Arbitrary.schema(S.Json)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* JsonCodec.stringify(value);
        const argument = S.decodeUnknownEffect(S.Json);
        const parsed1 = yield* JsonCodec.parse(encoded);
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
        const parsed = yield* JsonCodec.parse(input);
        const formatted = yield* JsonCodec.stringify(parsed);
        const reparsed = yield* JsonCodec.parse(formatted);
        assert.deepStrictEqual(reparsed, parsed);
        const stringify1 = yield* JsonCodec.stringify(reparsed);
        assert.strictEqual(stringify1, formatted);
      }),
    runs
  );
});
