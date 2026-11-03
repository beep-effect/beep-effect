import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

import { sanitize } from "@beep/cli-kit/Fmt";
import { neutralizeJson, sanitizeParts } from "@beep/cli-kit/internal/logSafety";
import * as Str from "effect/String";

const Json = S.fromJsonString(S.Json);
it.effect.prop(
  "NDJSON neutralization is idempotent and parsing its escaped form preserves every JSON value",
  [Arbitrary.schema(S.Json)],
  ([value]) =>
    Effect.gen(function* () {
      const stringify = S.encodeEffect(Json);
      const parse = S.decodeEffect(Json);
      const encoded = yield* stringify(value);
      const neutral = neutralizeJson(encoded);
      assert.strictEqual(neutralizeJson(neutral), neutral);
      assert.strictEqual(Str.includes("##[")(neutral), false);
      const parsed = yield* parse(neutral);
      const parsed1 = yield* parse(encoded);
      assert.deepStrictEqual(parsed, parsed1);
      const stringify4 = yield* stringify(parsed);
      const parsed2 = yield* parse(neutralizeJson(stringify4));
      assert.deepStrictEqual(parsed2, parsed);
      // Force the runner-command spelling in every sample, including scalars.
      const command = yield* stringify({ text: `##[warning]${encoded}` });
      const parsed3 = yield* parse(neutralizeJson(command));
      const parsed5 = yield* parse(command);
      assert.deepStrictEqual(parsed3, parsed5);
    }),
  runs
);
it.effect.prop(
  "sanitizing message strings and parts is idempotent and preserves structured values",
  [Arbitrary.schema(S.String), Arbitrary.schema(S.Json)],
  ([text, value]) =>
    Effect.sync(() => {
      const decorated = `\u001b[31m${text}\u001b[0m`;
      const input = [decorated, { value }, 42];
      const once = sanitizeParts(input);
      assert.deepStrictEqual(once, [sanitize(decorated), { value }, 42]);
      assert.deepStrictEqual(sanitizeParts(once), once);
      assert.strictEqual(sanitizeParts(sanitizeParts(text)), sanitize(text));
    }),
  runs
);
