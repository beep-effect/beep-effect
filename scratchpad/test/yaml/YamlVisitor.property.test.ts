import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { Yaml } from "../../effected/yaml/Yaml.ts";
import { YamlFormat } from "../../effected/yaml/YamlFormat.ts";
import { YamlVisitor, YamlVisitorEvent } from "../../effected/yaml/YamlVisitor.ts";

const runs = { arbitrary: fcRuns(100) };
const values = S.Struct({ message: S.String, count: S.Int, enabled: S.Boolean, items: S.Array(S.String) });
describe("YamlVisitor parsing properties", () => {
  it.effect.prop("formatting is idempotent and visitor semantics survive parse/stringify", [Arbitrary.schema(values)], ([value]) => Effect.gen(function* () {
    const text = yield* Yaml.stringify(value);
    const formatted = YamlFormat.formatToString(text);
    assert.strictEqual(YamlFormat.formatToString(formatted), formatted);
    const parsed = yield* Yaml.parse(text);
    const roundTrip = yield* Yaml.stringify(parsed);
    assert.deepStrictEqual(yield* Yaml.parse(roundTrip), parsed);
    assert.deepStrictEqual(yield* Stream.runCollect(YamlVisitor.visit(roundTrip)), yield* Stream.runCollect(YamlVisitor.visit(text)));
  }), runs);
  it.effect.prop("visitor preserves scalar values and leading/trailing comment text", [Arbitrary.schema(S.String)], ([value]) => Effect.gen(function* () {
    const text = yield* Yaml.stringify(value);
    const events = yield* Stream.runCollect(YamlVisitor.visit(`# lead\n---\n${text}...\n# tail\n`));
    assert.deepStrictEqual(events.filter(YamlVisitorEvent.$is("Scalar")).map((e) => e.value), [value]);
    assert.deepStrictEqual(events.filter(YamlVisitorEvent.$is("Comment")).map((e) => e.text), [" lead", " tail"]);
  }), runs);
});
