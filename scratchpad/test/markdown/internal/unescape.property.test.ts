import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import { unescapeString } from "../../../effected/markdown/internal/unescape.ts";
// Decoding is deliberately one-pass: &amp;amp; is not idempotent. These
// properties apply idempotence to canonical encoded spellings, not raw decode.
const encode = (value: string): string => value.replace(/[\\&]/g, (char) => char === "&" ? "&amp;" : "\\\\");
describe("unescape property floor", () => {
  it.effect.prop("encoding arbitrary literals faithfully decodes and canonical spelling is idempotent", [Arbitrary.schema(S.String)], ([value]) => Effect.sync(() => {
    const encoded = encode(value);
    const decoded = unescapeString(encoded);
    assert.strictEqual(decoded, value);
    assert.strictEqual(encode(decoded), encoded);
    assert.strictEqual(encode(unescapeString(encode(unescapeString(encoded)))), encoded);
    assert.strictEqual(unescapeString(`\\*${encoded}&#65;&#x42;&amp;`), `*${value}AB&`);
  }), runs);
});
