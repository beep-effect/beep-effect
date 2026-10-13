import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { unescape as oracleUnescape } from "minimatch";
import { escape } from "../../../effected/glob/internal/escape.ts";
import { unescape } from "../../../effected/glob/internal/unescape.ts";

const runs = { arbitrary: fcRuns(100) };
const options = Arbitrary.schema(S.Struct({ windowsPathsNoEscape: S.Boolean, magicalBraces: S.Boolean }));
// Unescape consumes one escape layer. Literal normal forms exclude backslashes
// and brackets, which can reveal another escape layer on a later pass.
const normalText = S.Literals(["a", "é", "*", "?", "(", ")", "{", "}", "/", ",", "+", "@", " "])
  .pipe(S.Array, Arbitrary.schema, Arbitrary.map(A.join("")));

describe("unescape property floor", () => {
  it.effect.prop("escaped literals decode faithfully and re-encoding parsed values preserves them", [Arbitrary.schema(S.String), options], ([literal, mode]) => Effect.sync(() => {
    const parsed = unescape(escape(literal, mode), mode);
    assert.strictEqual(parsed, literal);
    assert.strictEqual(unescape(escape(parsed, mode), mode), parsed);
    assert.strictEqual(unescape(mode)(escape(literal, mode)), parsed);
  }), runs);

  it.effect.prop("unescaping encoded normal forms is idempotent", [normalText, options], ([literal, mode]) => Effect.sync(() => {
    const formatted = unescape(escape(`*?${literal}`, mode), mode);
    assert.strictEqual(formatted, `*?${literal}`);
    assert.strictEqual(unescape(formatted, mode), formatted);
  }), runs);

  it.effect.prop("all option modes retain the README minimatch dialect fidelity", [Arbitrary.schema(S.String), options], ([pattern, mode]) => Effect.sync(() => {
    const parsed = unescape(pattern, mode);
    assert.strictEqual(parsed, oracleUnescape(pattern, mode));
    assert.strictEqual(unescape(escape(parsed, mode), mode), parsed);
  }), runs);
});
