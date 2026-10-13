import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { braceExpand } from "minimatch";
import { expand } from "../../../effected/glob/internal/braceExpansion.ts";
const runs = { arbitrary: fcRuns(100) };
const alternatives = S.Literals(["a", "b", "é", "txt", "js"]).pipe(S.Array, Arbitrary.schema, Arbitrary.map((parts) => parts.slice(0, 8)));
describe("brace expansion property floor", () => {
  it.effect.prop("shell parameter groups remain literal while their suffix alternatives expand faithfully", [alternatives], ([parts]) => Effect.sync(() => {
    const prefix = parts.map((part) => `\u0024{${part}}`).join("");
    const text = `${prefix}{left,right}`;
    const parsed = expand(text);
    assert.deepStrictEqual(parsed, [`${prefix}left`, `${prefix}right`]);
    assert.deepStrictEqual(parsed, braceExpand(text));
    assert.deepStrictEqual(parsed.flatMap((part) => expand(part)), parsed);
  }), runs);
  it.effect.prop("expanded alternatives are stable and serialize to the same expansion", [alternatives], ([parts]) => Effect.sync(() => {
    const text = `pre{${parts.join(",")},end}post`;
    const parsed = expand(text);
    const rendered = `{${parsed.join(",")}}`;
    assert.deepStrictEqual(expand(rendered), parsed);
    assert.deepStrictEqual(parsed.flatMap((part) => expand(part)), parsed);
    assert.deepStrictEqual(expand(`{${expand(rendered).join(",")}}`), parsed);
    assert.deepStrictEqual(parsed, braceExpand(text));
    assert.deepStrictEqual(parsed, (parts.length === 0 ? ["", "end"] : [...parts, "end"]).map((part) => `pre${part}post`));
  }), runs);
  it.effect.prop("sequence expansion preserves the upstream dialect and fixed-point fidelity", [Arbitrary.schema(S.Int), Arbitrary.schema(S.Int)], ([a, b]) => Effect.sync(() => {
    const text = `x{${a % 20}..${b % 20}}y`;
    const parsed = expand(text);
    assert.deepStrictEqual(parsed, braceExpand(text));
    assert.deepStrictEqual(parsed.flatMap((part) => expand(part)), parsed);
    assert.deepStrictEqual(expand(`{${parsed.join(",")},sentinel}`).slice(0, -1), parsed);
  }), runs);
});
