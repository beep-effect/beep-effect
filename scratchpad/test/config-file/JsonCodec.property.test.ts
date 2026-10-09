import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
import { JsonCodec } from "../../effected/config-file/JsonCodec.ts";

const equivalent = S.toEquivalence(S.Json);

describe("JsonCodec properties", () => {
  it.effect.prop("parse(stringify(x)) recovers every JSON value without failure", [Arbitrary.schema(S.Json)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* JsonCodec.stringify(value);
      const decoded = yield* S.decodeUnknownEffect(S.Json)(yield* JsonCodec.parse(encoded));
      assert.isTrue(equivalent(decoded, value));
    }), runs);

  it.effect.prop("normalization is idempotent and parse/stringify preserves the parsed document", [Arbitrary.schema(S.Json)], ([value]) =>
    Effect.gen(function* () {
      const input = yield* S.encodeEffect(S.fromJsonString(S.Json))(value);
      const parsed = yield* JsonCodec.parse(input);
      const formatted = yield* JsonCodec.stringify(parsed);
      const reparsed = yield* JsonCodec.parse(formatted);
      assert.deepStrictEqual(reparsed, parsed);
      assert.strictEqual(yield* JsonCodec.stringify(reparsed), formatted);
    }), runs);
});
