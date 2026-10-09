import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import { neutralizeJson, sanitizeParts } from "../../../effected/cli/internal/logSafety.ts";
import { sanitize } from "../../../effected/cli/Fmt.ts";
const Json = S.fromJsonString(S.Json);
it.effect.prop("NDJSON neutralization is idempotent and parsing its escaped form preserves every JSON value", [Arbitrary.schema(S.Json)], ([value]) => Effect.gen(function* () {
  const stringify = S.encodeEffect(Json);
  const parse = S.decodeEffect(Json);
  const encoded = yield* stringify(value);
  const neutral = neutralizeJson(encoded);
  assert.strictEqual(neutralizeJson(neutral), neutral);
  assert.strictEqual(neutral.includes("##["), false);
  const parsed = yield* parse(neutral);
  assert.deepStrictEqual(parsed, yield* parse(encoded));
  assert.deepStrictEqual(yield* parse(neutralizeJson(yield* stringify(parsed))), parsed);
  // Force the runner-command spelling in every sample, including scalars.
  const command = yield* stringify({ text: `##[warning]${encoded}` });
  assert.deepStrictEqual(yield* parse(neutralizeJson(command)), yield* parse(command));
}), runs);
it.effect.prop("sanitizing message strings and parts is idempotent and preserves structured values", [Arbitrary.schema(S.String), Arbitrary.schema(S.Json)], ([text, value]) => Effect.sync(() => {
  const decorated = `\u001b[31m${text}\u001b[0m`;
  const input = [decorated, { value }, 42];
  const once = sanitizeParts(input);
  assert.deepStrictEqual(once, [sanitize(decorated), { value }, 42]);
  assert.deepStrictEqual(sanitizeParts(once), once);
  assert.strictEqual(sanitizeParts(sanitizeParts(text)), sanitize(text));
}), runs);
