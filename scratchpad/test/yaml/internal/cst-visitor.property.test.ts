import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { cstEvents } from "../../../effected/yaml/internal/cst-visitor.ts";
import { Yaml } from "../../../effected/yaml/Yaml.ts";
import { YamlFormat } from "../../../effected/yaml/YamlFormat.ts";

const runs = { arbitrary: fcRuns(100) };
const Word = S.Array(S.Literals(["a", "b", "c", "0", "1", " ", "#", ":", "'", "é"]));
const words = Word.pipe(S.Array, Arbitrary.schema);
const projection = (text: string) => A.map(A.filter([...cstEvents(text)], (event) => event._tag === "CstScalarEvent"), (event) => event.source);

describe("CST visitor property floor", () => {
  it.effect.prop("formatting is idempotent and preserves raw quoted scalar events and comments", [words], ([samples]) => Effect.sync(() => {
    const quoted = A.map(samples, (chars) => `'${Str.replaceAll("'", "''")(A.join(chars, ""))}'`);
    const source = `[ ${A.join(quoted, " , ")} ] # retained\n`;
    const formatted = YamlFormat.formatToString(source);
    assert.strictEqual(YamlFormat.formatToString(formatted), formatted);
    assert.deepStrictEqual(projection(source), quoted);
    assert.deepStrictEqual(projection(formatted), quoted);
    assert.deepStrictEqual(A.map(A.filter([...cstEvents(formatted)], (event) => event._tag === "CstCommentEvent"), (event) => event.source), ["# retained"]);
  }), runs);

  it.effect.prop("parse/stringify fidelity preserves the sequence scalar events and decoded values", [words], ([samples]) => Effect.gen(function* () {
    const values = A.map(samples, (chars) => A.join(chars, ""));
    const source = yield* Yaml.stringify(values);
    const parsed = yield* Yaml.parse(source);
    const rendered = yield* Yaml.stringify(parsed);
    assert.deepStrictEqual(yield* Yaml.parse(rendered), parsed);
    assert.deepStrictEqual(parsed, values);
    assert.deepStrictEqual(projection(rendered), projection(source));
    assert.deepStrictEqual([...cstEvents(rendered)], [...cstEvents(source)]);
  }), runs);
});
