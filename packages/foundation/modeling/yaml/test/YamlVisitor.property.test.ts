import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Yaml } from "@beep/yaml/Yaml";
import { YamlFormat } from "@beep/yaml/YamlFormat";
import { YamlVisitor, YamlVisitorEvent } from "@beep/yaml/YamlVisitor";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

const runs = { arbitrary: fcRuns(100) };
const values = S.Struct({ message: S.String, count: S.Int, enabled: S.Boolean, items: S.Array(S.String) });
describe("YamlVisitor parsing properties", () => {
  it.effect.prop(
    "formatting is idempotent and visitor semantics survive parse/stringify",
    [Arbitrary.schema(values)],
    ([value]) =>
      Effect.gen(function* () {
        const text = yield* Yaml.stringify(value);
        const formatted = YamlFormat.formatToString(text);
        assert.strictEqual(YamlFormat.formatToString(formatted), formatted);
        const parsed = yield* Yaml.parse(text);
        const roundTrip = yield* Yaml.stringify(parsed);
        const parsed1 = yield* Yaml.parse(roundTrip);
        assert.deepStrictEqual(parsed1, parsed);
        const resultCollect = yield* Stream.runCollect(YamlVisitor.visit(roundTrip));
        const resultCollect2 = yield* Stream.runCollect(YamlVisitor.visit(text));
        assert.deepStrictEqual(resultCollect, resultCollect2);
      }),
    runs
  );
  it.effect.prop(
    "visitor preserves scalar values and leading/trailing comment text",
    [Arbitrary.schema(S.String)],
    ([value]) =>
      Effect.gen(function* () {
        const text = yield* Yaml.stringify(value);
        const events = yield* Stream.runCollect(YamlVisitor.visit(`# lead\n---\n${text}...\n# tail\n`));
        assert.deepStrictEqual(
          A.map(A.filter(events, YamlVisitorEvent.$is("Scalar")), (e) => e.value),
          [value]
        );
        assert.deepStrictEqual(
          A.map(A.filter(events, YamlVisitorEvent.$is("Comment")), (e) => e.text),
          [" lead", " tail"]
        );
      }),
    runs
  );
});
