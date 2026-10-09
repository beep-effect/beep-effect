import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import { encodePath, encodeForOsc8, fileUrlPath } from "../../../effected/cli/internal/linkTarget.ts";
it.effect.prop("path segment encoding round-trips normalized Unicode, preserves separators, and stabilizes after decoding", [Arbitrary.schema(S.String)], ([path]) => Effect.sync(() => {
  const encoded = encodePath(path);
  const parsed = decodeURIComponent(encoded);
  assert.strictEqual(parsed, path.toWellFormed());
  assert.strictEqual(encodePath(parsed), encoded);
  assert.strictEqual(decodeURIComponent(encodePath(decodeURIComponent(encoded))), parsed);
  assert.strictEqual(encoded.split("/").length, path.split("/").length);
  // Percent encoding is an encoder, not a sanitizer: '%' itself must be escaped.
  assert.strictEqual(encodePath("%"), "%25");
}), runs);
it.effect.prop("OSC8 encoding is idempotent, preserves existing escapes and faithfully encodes UTF8", [Arbitrary.schema(S.String)], ([input]) => Effect.sync(() => {
  const encoded = encodeForOsc8(input);
  assert.strictEqual(encodeForOsc8(encoded), encoded);
  assert.match(encoded, /^[\x20-\x7e]*$/);
  const noPercent = input.replaceAll("%", "pct");
  const parsed = decodeURIComponent(encodeForOsc8(noPercent));
  assert.strictEqual(parsed, noPercent.toWellFormed());
  assert.strictEqual(decodeURIComponent(encodeForOsc8(parsed)), parsed);
  assert.strictEqual(encodeForOsc8("%C3%A9"), "%C3%A9");
  const absolute = `/root/${input}`;
  const target = fileUrlPath(absolute);
  assert.strictEqual(target, encodePath(absolute));
}), runs);
