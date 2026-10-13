import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assertSome } from "@effect/vitest/utils";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { normalizeEnv, readEnv } from "../../../effected/env/internal/envRecord.ts";

const runs = { arbitrary: fcRuns(100) };
const Input = S.Struct({
  AI_AGENT: S.UndefinedOr(S.String),
  CI: S.UndefinedOr(S.String),
  TERM_PROGRAM: S.UndefinedOr(S.String),
});
const json = S.fromJsonString(S.Record(S.String, S.String));

describe("environment normalization and parsing fidelity", () => {
  it.effect.prop("normalizing twice is stable and preserves every non-empty value", [Arbitrary.schema(Input)], ([input]) =>
    Effect.sync(() => {
      const clean = normalizeEnv(input);
      assert.deepStrictEqual(normalizeEnv(clean), clean);
      for (const [key, value] of R.toEntries(input)) {
        if (value === undefined || value === "") {
          assert.isFalse(R.has(clean, key));
        } else {
          assertSome(R.get(clean, key), value);
        }
      }
    }), runs);

  it.effect.prop("Config parsing agrees with normalization and survives JSON serialization", [Arbitrary.schema(Input)], ([input]) =>
    Effect.gen(function* () {
      const parsed = yield* readEnv(R.keys(input)).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(input)),
      );
      assert.deepStrictEqual(parsed, normalizeEnv(input));
      const text = yield* S.encodeUnknownEffect(json)(parsed);
      const restored = yield* S.decodeEffect(json)(text);
      const reparsed = yield* readEnv(R.keys(restored)).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(restored)),
      );
      assert.deepStrictEqual(reparsed, parsed);
      assert.strictEqual(yield* S.encodeUnknownEffect(json)(reparsed), text);
    }), runs);
});
