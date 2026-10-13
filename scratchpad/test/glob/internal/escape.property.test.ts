import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { escape as oracleEscape } from "minimatch";
import { escape } from "../../../effected/glob/internal/escape.ts";
import { unescape } from "../../../effected/glob/internal/unescape.ts";
const runs = { arbitrary: fcRuns(100) };
const text = S.Literals(["a", "é", "?", "*", "(", ")", "[", "]", "{", "}", ",", "+", "@", "!"]).pipe(S.Array, Arbitrary.schema, Arbitrary.map((parts) => parts.join("")));
describe("escape property floor", () => {
  it.effect.prop("escape/unescape fidelity and canonical escaped rendering idempotence", [text, Arbitrary.schema(S.Boolean), Arbitrary.schema(S.Boolean)], ([input, windowsPathsNoEscape, magicalBraces]) => Effect.sync(() => {
    const options = { windowsPathsNoEscape, magicalBraces };
    const rendered = escape(input, options);
    assert.strictEqual(unescape(rendered, options), input);
    const canonical = escape(unescape(rendered, options), options);
    assert.strictEqual(canonical, rendered);
    assert.strictEqual(escape(unescape(canonical, options), options), canonical);
    assert.strictEqual(rendered, oracleEscape(input, options));
  }), runs);
});
