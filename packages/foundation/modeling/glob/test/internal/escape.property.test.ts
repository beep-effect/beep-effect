import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { escape } from "@beep/glob/internal/escape";
import { unescape } from "@beep/glob/internal/unescape";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { escape as oracleEscape } from "minimatch";

const runs = { arbitrary: fcRuns(100) };
const text = S.Literals(["a", "é", "?", "*", "(", ")", "[", "]", "{", "}", ",", "+", "@", "!"]).pipe(
  S.Array,
  Arbitrary.schema,
  Arbitrary.map((parts) => A.join(parts, ""))
);
describe("escape property floor", () => {
  it.effect.prop(
    "escape/unescape fidelity and canonical escaped rendering idempotence, leaving +@! bare like the oracle: the escaped parens disarm extglobs and [!] would open a negated class",
    [text, Arbitrary.schema(S.Boolean), Arbitrary.schema(S.Boolean)],
    ([input, windowsPathsNoEscape, magicalBraces]) =>
      Effect.sync(() => {
        const options = { windowsPathsNoEscape, magicalBraces };
        const rendered = escape(input, options);
        assert.strictEqual(unescape(rendered, options), input);
        const canonical = escape(unescape(rendered, options), options);
        assert.strictEqual(canonical, rendered);
        assert.strictEqual(escape(unescape(canonical, options), options), canonical);
        assert.strictEqual(rendered, oracleEscape(input, options));
      }),
    runs
  );
});
